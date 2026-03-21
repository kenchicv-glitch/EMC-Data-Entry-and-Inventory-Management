import pandas as pd
import os

# Paths
report_path = r'C:\Users\PC\Downloads\EMC_Price_Verification_Report.xlsx'
inventory_path = r'C:\Users\PC\Downloads\Inventory_EMC_3_2026_03_19.xlsx'
pl_path = r'C:\Users\PC\Downloads\EMC_PL_kenchi_CLEAN.xlsx'
output_path = r'C:\Users\PC\Downloads\Inventory_EMC_3_2026_03_19_CORRECTED.xlsx'

# 1. Load Report
report_df = pd.read_excel(report_path, sheet_name='Errors', skiprows=2)
report_df.columns = [str(c).strip() for c in report_df.columns]
swaps_names = report_df[report_df['Issue Type'] == 'SRP & WSP SWAPPED']['Item Name'].str.strip().str.upper().tolist()
print(f"Targeting {len(swaps_names)} items for swap.")

# 2. Load Price List (PL)
xl_pl = pd.ExcelFile(pl_path)
pl_map = {}
for sheet in xl_pl.sheet_names:
    if sheet == 'All Products': continue
    df = pd.read_excel(xl_pl, sheet, header=None)
    
    header_idx = None
    for i in range(min(15, len(df))):
        row_vals = [str(x).upper().strip() for x in df.iloc[i].tolist()]
        if 'PRODUCT NAME' in row_vals or 'PRODUCT / VARIANT' in row_vals:
            header_idx = i
            break
    
    if header_idx is not None:
        headers = [str(x).upper().strip() for x in df.iloc[header_idx].tolist()]
        p_idx = next((j for j, h in enumerate(headers) if 'PRODUCT' in h), 3)
        c_idx = next((j for j, h in enumerate(headers) if 'CATEGORY' == h), 1)
        s_idx = next((j for j, h in enumerate(headers) if 'SUB-CATEGORY' in h or 'SUB CATEGORY' in h), 2)
        # Be more specific for WSP/SRP to avoid WSP CODE
        wsp_idx = next((j for j, h in enumerate(headers) if 'WSP (PHP)' in h or h == 'WSP'), 5)
        srp_idx = next((j for j, h in enumerate(headers) if 'SRP (PHP)' in h or h == 'SRP'), 6)

        for i in range(header_idx + 1, len(df)):
            row = df.iloc[i]
            parts = []
            if pd.notna(row[c_idx]): parts.append(str(row[c_idx]).strip().upper())
            if pd.notna(row[s_idx]): parts.append(str(row[s_idx]).strip().upper())
            if pd.notna(row[p_idx]): parts.append(str(row[p_idx]).strip().upper())
            
            full_name = " > ".join([p for p in parts if p and p != 'NAN'])
            if full_name:
                pl_map[full_name] = {'wsp': row[wsp_idx], 'srp': row[srp_idx]}
    else:
        print(f"Warning: Could not find header in {sheet}")

print(f"Loaded {len(pl_map)} total items from Price List.")

# 3. Process Inventory
xlsx_inv = pd.ExcelFile(inventory_path)
inventory_dfs = {}
corrected_count = 0

for sheet in xlsx_inv.sheet_names:
    df = xlsx_inv.parse(sheet)
    # Convert to object dtype to avoid int64 assignment errors for non-numeric or mismatched types
    df = df.astype(object)
    df.columns = [str(c).strip().upper() for c in df.columns]
    
    name_col = next((c for c in df.columns if 'ITEM' in c and ('NAME' in c or 'DESCRIPTION' in c)), None)
    cost_col = next((c for c in df.columns if 'BUYING' in c or 'COST' in c), None)
    srp_col = next((c for c in df.columns if 'SELLING' in c or 'SRP' in c), None)
    
    if name_col and cost_col and srp_col:
        for idx, row in df.iterrows():
            name = str(row[name_col]).strip().upper()
            if name in swaps_names:
                pl_data = pl_map.get(name)
                # Fuzzy
                if not pl_data:
                    for pl_name, data in pl_map.items():
                        if pl_name == name or pl_name.startswith(name) or name.startswith(pl_name):
                            pl_data = data
                            break
                if pl_data:
                    # Final check: Ensure values are numeric or at least not obviously wrong
                    try:
                        wsp_val = float(pl_data['wsp']) if pd.notna(pl_data['wsp']) else row[cost_col]
                        srp_val = float(pl_data['srp']) if pd.notna(pl_data['srp']) else row[srp_col]
                        df.at[idx, cost_col] = wsp_val
                        df.at[idx, srp_col] = srp_val
                        corrected_count += 1
                    except:
                        pass
    
    inventory_dfs[sheet] = df

# Save
with pd.ExcelWriter(output_path) as writer:
    for sheet, df in inventory_dfs.items():
        df.to_excel(writer, sheet_name=sheet, index=False)

print(f"Done. Successfully swapped {corrected_count} items.")
print(f"Output saved to: {output_path}")
