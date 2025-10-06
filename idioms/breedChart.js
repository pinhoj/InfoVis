// breedChart.js
// Renders the Top-10 breeds bar chart. Publishes a "filter" event with { dog_breed }.
// Exposes update(), highlightBreed(), highlightByGroup(), and on().
import { COLORS } from '../colors.js';

export function createBreedChart(container, data, { width, height, margin }) {
  const dispatch = d3.dispatch("filter", "hover"); 

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .range([0, width]);

  const y = d3.scaleBand()
    .range([0, height])
    .padding(0.3);

  // axis groups we can reuse on update
  const xAxisG = svg.append("g")
      .attr("transform", `translate(0,${height})`);

  const yAxisG = svg.append("g");

  // bars container to keep joins stable
  const gBars = svg.append("g");

  // Title
  const title = svg.append("text")
    .attr("x", width / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("font-weight", "bold")
    .text("Top 10 Dog Breeds in Vienna");

  // Tooltip (scoped; avoid duplicates by selecting or creating)
  const tooltip = d3.select('body').selectAll('.tooltip-breeds').data([null]).join('div')
    .attr('class', 'tooltip-breeds')
    .style('position', 'absolute')
    .style('background', 'white')
    .style('border', '1px solid #ccc')
    .style('padding', '6px 10px')
    .style('border-radius', '6px')
    .style('box-shadow', '0 2px 6px rgba(0,0,0,0.2)')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  let bars = gBars.selectAll('rect');
  let selectedBreed = null; // local mirror of controller state

  // helper to attach handlers to both enter/update selections
  function wireHandlers(sel) {
    sel
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(150).style("opacity", 1);
        tooltip.html(`Breed: ${d.dog_breed}<br/>Group: ${d.dog_breed_group}<br/>Count: ${d3.format(".3~s")(d.dog_count)}`);
        
        if (selectedBreed != d.dog_breed){
          dispatch.call('hover', null, { dog_breed_group: d.dog_breed_group });
          d3.select(this).attr("fill", COLORS[d.dog_breed_group].hover);
        }
      })
      .on("mousemove", function (event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function (event, d) {
        tooltip.transition().duration(150).style("opacity", 0);
        dispatch.call('hover', null, { dog_breed_group: null });
        d3.select(this).attr("fill", selectedBreed === d.dog_breed ? COLORS[d.dog_breed_group].selected : COLORS[d.dog_breed_group].base);
      })
      .on("click", function (event, d) {
        // local highlight
        const next = (selectedBreed === d.dog_breed) ? null : d.dog_breed;
        // emit event for outer world
        dispatch.call('filter', null, { dog_breed: next });
      });
    return sel;
  }

  function highlightBreed(breed) {
    bars.attr("fill", b => COLORS[b.dog_breed_group].base);
    if (breed != null) {
      bars.filter(b => b.dog_breed === breed).attr("fill", b =>COLORS[b.dog_breed_group].selected);
    }
  }

  function highlightByGroup(group) {
    bars.attr("fill", b => COLORS[b.dog_breed_group].base);
    if (group != null) {
      bars.filter(b => b.dog_breed_group === group).attr("fill", b =>COLORS[b.dog_breed_group].selected);
    }
  }

  function hoverByGroup(group) {
    if (group == null) {
      if (selectedBreed != null) {
        highlightBreed(selectedBreed);
      } else {
        bars.attr("fill", b => COLORS[b.dog_breed_group].base);
      }
      return;
    }

    bars.attr("fill", d => 
      selectedBreed === d.dog_breed ? COLORS[d.dog_breed_group].selected : 
      (d.dog_breed_group === group ? COLORS[d.dog_breed_group].hover : COLORS[d.dog_breed_group].base));
  }

  // NEW: update function to re-bind data & redraw
  function update(newData, state = {}) {
    selectedBreed = state.selectedBreed ?? null;

    // 1) scales
    x.domain([0, d3.max(newData, d => d.dog_count) || 0]).nice();
    y.domain(newData.map(d => d.dog_breed));

    // 2) axes
    xAxisG.transition().duration(250).call(d3.axisBottom(x).tickFormat(d3.format("~s")));
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
            .attr("fill", d => COLORS[d.dog_breed_group].base),
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
      highlightByGroup(state.selectedGroup, true);
      title.text("Top 10 " + state.selectedGroup + " in Vienna"); 
    } else {
      title.text("Top 10 Dog Breeds in Vienna"); 
    }
    if (state.selectedBreed != null) {
      highlightBreed(state.selectedBreed);
    } else {
      bars.attr("fill", b => COLORS[b.dog_breed_group].base);
    }
  }

   // Initial render
  update(data, { selectedGroup: null, selectedBreed: null });


  // Public API
  return {
    on: (type, handler) => (dispatch.on(type, handler), undefined),
    highlightBreed,
    highlightByGroup,
    update,
    hoverByGroup
  };
}
