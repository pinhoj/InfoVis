// breedChart.js
// Renders the Top-10 breeds bar chart. Publishes a "filter" event with { dog_breed }.
// Exposes update(), highlightBreed(), highlightByGroup(), and on().

export function createBreedChart(container, data, { width, height, margin }) {
  const dispatch = d3.dispatch('filter');

  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleLinear().range([0, width]);
  const y = d3.scaleBand().range([0, height]).padding(0.3);

  // Axes (kept for reuse on update)
  const xAxisG = svg.append('g').attr('transform', `translate(0,${height})`);
  const yAxisG = svg.append('g');

  // Bars container
  const gBars = svg.append('g');

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

  function wireHandlers(sel) {
    sel
      .on('mouseover', function (event, d) {
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(`Group: ${d.dog_breed_group}<br/>Count: ${d3.format(',')(d.dog_count)}`);
      })
      .on('mousemove', function (event) {
        tooltip.style('left', (event.pageX + 10) + 'px')
               .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        tooltip.transition().duration(150).style('opacity', 0);
      })
      .on('click', function (event, d) {
        // Toggle next selection based on current (controller-synced) state
        const next = (selectedBreed === d.dog_breed) ? null : d.dog_breed;
        // Publish semantic filter event; controller will recompute + call update()
        dispatch.call('filter', null, { dog_breed: next });
      });
    return sel;
  }

  function highlightBreed(breed) {
    bars.attr('fill', 'teal');
    if (breed != null) {
      bars.filter(b => b.dog_breed === breed).attr('fill', 'orange');
    }
  }

  function highlightByGroup(group) {
    bars.attr('fill', 'teal');
    if (group != null) {
      bars.filter(b => b.dog_breed_group === group).attr('fill', 'orange');
    }
  }

  function update(newData, state = {}) {
    // Sync local selection from controller
    selectedBreed = state.selectedBreed ?? null;

    // 1) Scales
    x.domain([0, d3.max(newData, d => d.dog_count) || 0]).nice();
    y.domain(newData.map(d => d.dog_breed));

    // 2) Axes
    xAxisG.transition().duration(250).call(d3.axisBottom(x));
    yAxisG.transition().duration(250).call(d3.axisLeft(y).tickSize(0));

    // 3) Join
    bars = wireHandlers(
      gBars.selectAll('rect')
        .data(newData, d => d.dog_breed)
        .join(
          enter => enter.append('rect')
            .attr('x', 0)
            .attr('y', d => y(d.dog_breed))
            .attr('height', y.bandwidth())
            .attr('width', d => x(d.dog_count))
            .attr('fill', 'teal'),
          update => update,
          exit => exit.transition().duration(200).style('opacity', 0).remove()
        )
    );

    // 4) Position/size
    bars.transition().duration(250)
      .attr('y', d => y(d.dog_breed))
      .attr('height', y.bandwidth())
      .attr('width', d => x(d.dog_count));

    // 5) Apply visual state
    if (state.selectedGroup != null) {
      // If a group filter is active, show that relation
      highlightByGroup(state.selectedGroup);
    } else if (state.selectedBreed != null) {
      highlightBreed(state.selectedBreed);
    } else {
      bars.attr('fill', 'teal');
    }
  }

  // Initial render
  update(data, { selectedGroup: null, selectedBreed: null });

  // Public API
  return {
    on: (type, handler) => (dispatch.on(type, handler), undefined), // listen to "filter"
    update,
    highlightBreed,
    highlightByGroup
  };
}
