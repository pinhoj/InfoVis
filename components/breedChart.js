// breedChart.js
// Exports a factory that renders the breed chart and exposes a small API.

export function createBreedChart(container, data, { width, height, margin }) {
  const dispatch = d3.dispatch("click"); // consumers can do chart.on("click", ...)

  const svg = d3.select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.dog_count)]).nice()
    .range([0, width]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.dog_breed))
    .range([0, height])
    .padding(0.3);

  // axis groups we can reuse on update
  const xAxisG = svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
  const yAxisG = svg.append("g").call(d3.axisLeft(y).tickSize(0));

  // bars container to keep joins stable
  const gBars = svg.append("g");

  // Tooltip (scoped to this chart)
  const tooltip = d3.select("body")
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

  // helper to attach handlers to both enter/update selections
  function wireHandlers(sel) {
    sel
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(150).style("opacity", 1);
        tooltip.html(`Group: ${d.dog_breed_group}<br/>Count: ${d3.format(",")(d.dog_count)}`);
      })
      .on("mousemove", function (event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function () {
        tooltip.transition().duration(150).style("opacity", 0);
      })
      .on("click", function (event, d) {
        // local highlight
        highlightBreed(d.dog_breed);
        // emit event for outer world
        dispatch.call("click", null, { dog_breed: d.dog_breed, dog_breed_group: d.dog_breed_group });
      });
    return sel;
  }

  // initial render
  let bars =  (
    gBars.selectAll("rect")
      .data(data, d => d.dog_breed)
      .join("rect")
        .attr("y", d => y(d.dog_breed))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.dog_count))
        .attr("fill", "teal")
  );

  function highlightBreed(breed) {
    bars.attr("fill", "teal");
    if (breed != null) {
      bars.filter(b => b.dog_breed === breed).attr("fill", "orange");
    }
  }

  function highlightByGroup(group) {
    bars.attr("fill", "teal");
    if (group != null) {
      bars.filter(b => b.dog_breed_group === group).attr("fill", "orange");
    }
  }

  // NEW: update function to re-bind data & redraw
  function update(newData, state = {}) {
    // 1) scales
    x.domain([0, d3.max(newData, d => d.dog_count) || 0]).nice();
    y.domain(newData.map(d => d.dog_breed));

    // 2) axes
    xAxisG.transition().duration(250).call(d3.axisBottom(x));
    yAxisG.transition().duration(250).call(d3.axisLeft(y).tickSize(0));

    // 3) join
    bars = wireHandlers(
      gBars.selectAll("rect")
        .data(newData, d => d.dog_breed)
        .join(
          enter => enter.append("rect")
            .attr("x", 0)
            .attr("y", d => y(d.dog_breed))
            .attr("height", y.bandwidth())
            .attr("width", d => x(d.dog_count))
            .attr("fill", "teal"),
          update => update,
          exit => exit.transition().duration(200).style("opacity", 0).remove()
        )
    );

    // 4) update positions/sizes (with a tiny transition)
    bars.transition().duration(250)
      .attr("y", d => y(d.dog_breed))
      .attr("height", y.bandwidth())
      .attr("width", d => x(d.dog_count));

    // 5) restore any external highlight state
    if (state.selectedGroup != null) {
      highlightByGroup(state.selectedGroup);
    } else if (state.selectedBreed != null) {
      highlightBreed(state.selectedBreed);
    } else {
      bars.attr("fill", "teal");
    }
  }

  // Public API
  return {
    on: (type, handler) => (dispatch.on(type, handler), undefined),
    highlightBreed,
    highlightByGroup,
    update
  };
}
