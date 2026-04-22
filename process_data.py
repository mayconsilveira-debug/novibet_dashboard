import pandas as pd

# Read the data
df = pd.read_excel('Dados_fake_completo_v2.xlsx', sheet_name='Base de dados')
pacing_df = pd.read_excel('Dados_fake_completo_v2.xlsx', sheet_name='Pacing')

# Extract year from Date
df['Year'] = pd.to_datetime(df['Date']).dt.year
pacing_df['Year'] = pd.to_datetime(pacing_df['Date']).dt.year

# Group by Year and Package for main data
summary = df.groupby(['Year', 'Pacote']).agg({
    'Total Impressions': 'sum',
    'Clicks': 'sum',
    'Complete views': 'sum',
    'Investiment': 'sum'
}).reset_index()

# Calculate CTR
summary['CTR'] = (summary['Clicks'] / summary['Total Impressions'] * 100)

# Group pacing data
pacing_summary = pacing_df.groupby(['Year', 'Pacote'])['Impressions Estimate'].sum().reset_index()

# Merge data
merged = summary.merge(pacing_summary, on=['Year', 'Pacote'], how='left')
merged['Impressions Estimate'] = merged['Impressions Estimate'].fillna(0)

print('=== Merged Data for 2026 ===')
for _, row in merged.iterrows():
    print(f"Package: {row['Pacote']}")
    print(f"  Invested: R$ {row['Investiment']:,.0f}")
    print(f"  Goal (Estimate): {row['Impressions Estimate']:,.0f} impressions")
    print(f"  Impressions: {row['Total Impressions']:,.0f}")
    print(f"  Clicks: {row['Clicks']}")
    print(f"  CTR: {row['CTR']:.2f}%")
    print(f"  Views: {row['Complete views']:,.0f}")
    print()

# Calculate totals
total_invested = merged['Investiment'].sum()
total_goal = merged['Impressions Estimate'].sum()
delivery_rate = (total_invested / total_goal * 100) if total_goal > 0 else 0

print(f'Total Invested: R$ {total_invested:,.0f}')
print(f'Total Goal: {total_goal:,.0f} impressions')
print(f'Delivery Rate: {delivery_rate:.2f}%')

# Generate JavaScript mockData structure
print('\n\n=== JAVASCRIPT MOCK DATA ===\n')
print('mockData: {')
print('  2026: {')
print(f"    vtr: '0,00%',")
print(f"    engagement: '0,00%',")
print(f"    deliveryRate: {delivery_rate:.2f},")
print('    packages: [')

for _, row in merged.iterrows():
    print('      {')
    print(f"        name: '{row['Pacote']}',")
    print(f"        invested: {int(row['Investiment'])},")
    print(f"        goal: {int(row['Impressions Estimate']) if row['Impressions Estimate'] > 0 else 1000000},")
    print(f"        impressions: {int(row['Total Impressions'])},")
    print(f"        ctr: {row['CTR']:.2f}")
    print('      },')

print('    ],')
print('  },')
print('}')
