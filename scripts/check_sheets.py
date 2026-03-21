import pandas as pd
import os

files = [
    r"C:\Users\PC\Downloads\EMC_PL_kenchi_CLEAN.xlsx",
    r"C:\Users\PC\Downloads\Inventory_EMC_3_2026_03_19.xlsx",
    r"C:\Users\PC\Downloads\EMC_PRICELIST_2026_CLEAN.xlsx",
    r"C:\Users\PC\Desktop\UPDATED PRICELIST 2024.xlsx"
]

for f in files:
    if os.path.exists(f):
        try:
            xl = pd.ExcelFile(f)
            print(f"File: {f}")
            print(f"Sheets: {xl.sheet_names}")
        except Exception as e:
            print(f"Error reading {f}: {e}")
    else:
        print(f"Not found: {f}")
