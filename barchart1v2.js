d3.csv("data/dogs_in_vienna.csv").then(data => {
  // Convert numeric fields
  data.forEach(d => d.dog_count = +d.dog_count);

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const width = 800 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  // ================== First Chart: Top 10 Breeds ==================
  const breedCounts = d3.rollup(
    data,
    v => d3.sum(v, d => d.dog_count),
    d => d.dog_breed
  );

  const aggregatedData = Array.from(breedCounts, ([dog_breed, dog_count]) => {
    const group = data.find(d => d.dog_breed === dog_breed).dog_breed_group;
    return { dog_breed, dog_count, dog_breed_group: group };
  }).sort((a,b) => d3.descending(a.dog_count, b.dog_count));

  const topBreeds = aggregatedData.slice(0, 10);

  const svg1 = d3.select("#chart2")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x1 = d3.scaleLinear()
    .domain([0, d3.max(topBreeds, d=>d.dog_count)]).nice()
    .range([0, width]);

  const y1 = d3.scaleBand()
    .domain(topBreeds.map(d => d.dog_breed))
    .range([0, height])
    .padding(0.3);

  svg1.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x1));
  svg1.append("g").call(d3.axisLeft(y1).tickSize(0));

  // Tooltip for first chart
  const tooltip1 = d3.select("body")
    .append("div")
    .attr("class","tooltip")
    .style("position","absolute")
    .style("background","white")
    .style("border","1px solid #ccc")
    .style("padding","6px 10px")
    .style("border-radius","6px")
    .style("box-shadow","0 2px 6px rgba(0,0,0,0.2)")
    .style("font-size","12px")
    .style("pointer-events","none")
    .style("opacity",0);

  // ================== Second Chart: Breed Groups ==================
  const groupCounts = d3.rollup(
    data,
    v => d3.sum(v, d=>d.dog_count),
    d => d.dog_breed_group
  );

  const groupData = Array.from(groupCounts, ([dog_breed_group, dog_count]) => ({ dog_breed_group, dog_count }))
    .sort((a,b)=>d3.descending(a.dog_count,b.dog_count));

  const svg2 = d3.select("#chart3")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x2 = d3.scaleLinear()
    .domain([0, d3.max(groupData,d=>d.dog_count)]).nice()
    .range([0, width]);

  const y2 = d3.scaleBand()
    .domain(groupData.map(d => d.dog_breed_group))
    .range([0, height])
    .padding(0.3);

  svg2.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x2));
  svg2.append("g").call(d3.axisLeft(y2).tickSize(0));

  // Tooltip for second chart
  const tooltip2 = d3.select("body")
    .append("div")
    .attr("class","tooltip")
    .style("position","absolute")
    .style("background","white")
    .style("border","1px solid #ccc")
    .style("padding","6px 10px")
    .style("border-radius","6px")
    .style("box-shadow","0 2px 6px rgba(0,0,0,0.2)")
    .style("font-size","12px")
    .style("pointer-events","none")
    .style("opacity",0);

  // ========== Bars for first chart ==========
  const bars1 = svg1.selectAll("rect")
    .data(topBreeds)
    .enter().append("rect")
    .attr("y", d=>y1(d.dog_breed))
    .attr("x",0)
    .attr("height", y1.bandwidth())
    .attr("width", d=>x1(d.dog_count))
    .attr("fill","teal")
    .on("mouseover", function(event,d){
      tooltip1.transition().duration(200).style("opacity",1)
      tooltip1.html(`Group: ${d.dog_breed_group}<br/>Count: ${d3.format(",")(d.dog_count)}`);
    })
    .on("mousemove", function(event){
      tooltip1.style("left",(event.pageX+10)+"px").style("top",(event.pageY-28)+"px");
    })
    .on("mouseout", function(){
      tooltip1.transition().duration(200).style("opacity",0);
    })
    .on("click", function(event,d){
      // Highlight clicked breed
      bars1.attr("fill","teal");
      d3.select(this).attr("fill","orange");
      // Highlight corresponding group
      bars2.attr("fill","teal");
      bars2.filter(g => g.dog_breed_group === d.dog_breed_group)
        .attr("fill","orange");
    });

  // ========== Bars for second chart ==========
  const bars2 = svg2.selectAll("rect")
    .data(groupData)
    .enter().append("rect")
    .attr("y", d=>y2(d.dog_breed_group))
    .attr("x",0)
    .attr("height", y2.bandwidth())
    .attr("width", d=>x2(d.dog_count))
    .attr("fill","teal")
    .on("mouseover", function(event,d){
      tooltip2.transition().duration(200).style("opacity",1)
      tooltip2.html(`Count: ${d3.format(",")(d.dog_count)}`);
    })
    .on("mousemove", function(event){
      tooltip2.style("left",(event.pageX+10)+"px").style("top",(event.pageY-28)+"px");
    })
    .on("mouseout", function(){
      tooltip2.transition().duration(200).style("opacity",0);
    })
    .on("click", function(event,d){
      // Highlight clicked group
      bars2.attr("fill","teal");
      d3.select(this).attr("fill","orange");
      // Highlight all breeds in this group
      bars1.attr("fill","teal");
      bars1.filter(b => b.dog_breed_group === d.dog_breed_group)
        .attr("fill","orange");
    });
});
