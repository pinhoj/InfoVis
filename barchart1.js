d3.csv("./data/dogs_in_vienna.csv").then(data => {
  // Convert numeric fields
  data.forEach(d => {
    d.dog_count = +d.dog_count;
  });

  // Aggregate counts by breed
  const breedCounts = d3.rollup(
    data, 
    v => d3.sum(v, d => d.dog_count),
    d => d.dog_breed
  );

  // Convert Map to array of objects, also keep group
  let aggregatedData = Array.from(breedCounts, ([dog_breed, dog_count]) => {
    const group = data.find(d => d.dog_breed === dog_breed).dog_breed_group;
    return { dog_breed, dog_count, dog_breed_group: group };
  });

  // Sort descending
  aggregatedData.sort((a, b) => d3.descending(a.dog_count, b.dog_count));

  // Take top 10 breeds
  const topBreeds = aggregatedData.slice(0, 10);

  // Set dimensions & margins
  const margin = { top: 60, right: 40, bottom: 60, left: 160 };
  const width = 900 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // X scale (counts → horizontal axis)
  const x = d3.scaleLinear()
    .domain([0, d3.max(topBreeds, d => d.dog_count)])
    .nice()
    .range([0, width]);

  // Y scale (breeds → vertical axis, top to bottom)
  const y = d3.scaleBand()
    .domain(topBreeds.map(d => d.dog_breed))
    .range([0, height])
    .padding(0.3);

  // X-axis
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .style("font-size", "12px");

  // Y-axis
  svg.append("g")
    .call(d3.axisLeft(y).tickSize(0))
    .style("font-size", "12px");

  // Tooltip div
  const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "6px 10px")
    .style("border-radius", "6px")
    .style("box-shadow", "0 2px 6px rgba(0,0,0,0.2)")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  // Bars
  svg.selectAll("rect")
    .data(topBreeds)
    .enter().append("rect")
    .attr("y", d => y(d.dog_breed))
    .attr("x", 0)
    .attr("height", y.bandwidth())
    .attr("width", d => x(d.dog_count))
    .attr("fill", "teal")
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(200).style("opacity", 1);
      tooltip.html(`
        Group: ${d.dog_breed_group}<br/>
        Count: ${d3.format(",")(d.dog_count)}
      `);
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => {
      tooltip.transition().duration(200).style("opacity", 0);
    })
    .on("click", function(event, d) {
      // Reset all bars to teal
      svg.selectAll("rect").attr("fill", "teal");
      // Highlight the clicked bar
      d3.select(this).attr("fill", "orange");
    });

  // Title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("font-weight", "bold")
    .text("Top 10 Dog Breeds in Vienna");

  // X-axis label
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 45)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Number of Dogs");
});
