import pandas as pd

def show_info(path, sheet, skip=0):
    print(f"\n--- {path} [{sheet}] ---")
    df = pd.read_excel(path, sheet_name=sheet, skiprows=skip)
    print("Columns:", df.columns.tolist())
    print("Head:\n", df.iloc[:5, :3].to_string())

# Report
report_path = r'C:\Users\PC\Downloads\EMC_Price_Verification_Report.xlsx'
show_info(report_path, 'Errors', 2)

# Inventory
inv_path = r'C:\Users\PC\Downloads\Inventory_EMC_3_2026_03_19.xlsx'
xl_inv = pd.ExcelFile(inv_path)
show_info(inv_path, xl_inv.sheet_names[0])

# Price List
pl_path = r'C:\Users\PC\Downloads\EMC_PL_kenchi_CLEAN.xlsx'
xl_pl = pd.ExcelFile(pl_path)
show_info(pl_path, 'All Products')
