function init() {
  d3.json("./data/dogs_in_vienna.csv").then(function (data) {
    createBarchart(data, ".BarChart");
    
  });
}