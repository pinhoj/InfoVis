import pandas as pd
import geopandas as gpd
import matplotlib.pyplot as plt
austria = gpd.GeoDataFrame.from_file("geodata/gemeinden_995_geo.json")
vienna = austria[austria["name"].str.contains('Wien-', regex=False)]

vienna["name"] = vienna["name"].apply(lambda x: x[5:])

vienna.loc[-1] = austria[austria["name"] == "Wien"].loc[0]
vienna.index = vienna.index + 1
vienna = vienna.sort_index().reset_index( drop=True)
vienna["iso"] = vienna["iso"].apply(lambda x: int(x)) - 1
# vienna.loc["name","iso"].to_csv("geodata/vienna_codes.csv")

vienna.to_file("geodata/vienna_districts.json", driver="GeoJSON")

