// groupChart.js
// Renders the breed-group bar chart and exposes an API with update() + events.
// Uses a semantic "filter" event to tell the controller which group to filter by.

export function createGroupChart(container, data, { width, height, margin }) {
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

  // Axis groups (called inside update)
  const xAxisG = svg.append('g').attr('transform', `translate(0,${height})`);
  const yAxisG = svg.append('g');

  // Bars container
  const gBars = svg.append('g');

  // Tooltip scoped to this chart
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('background', 'white')
    .style('border', '1px solid #ccc')
    .style('padding', '6px 10px')
    .style('border-radius', '6px')
    .style('box-shadow', '0 2px 6px rgba(0,0,0,0.2)')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  // This local mirrors controller state so clicks can toggle correctly.
  let selectedGroup = null;

  // Attach handlers to a selection (both enter & update)
  function wireHandlers(sel) {
    sel
      .on('mouseover', function (event, d) {
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(`Count: ${d3.format(',')(d.dog_count)}`);
      })
      .on('mousemove', function (event) {
        tooltip.style('left', (event.pageX + 10) + 'px')
               .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        tooltip.transition().duration(150).style('opacity', 0);
      })
      .on('click', function (event, d) {
        // Toggle next selection relative to current controller-driven state
        const next = (selectedGroup === d.dog_breed_group) ? null : d.dog_breed_group;
        // Publish semantic filter event (controller will recompute + call update)
        dispatch.call('filter', null, { dog_breed_group: next });
      });
    return sel;
  }

  let bars = gBars.selectAll('rect'); // will be bound in first update

  function highlightGroup(group) {
    bars.attr('fill', 'teal');
    if (group != null) {
      bars.filter(b => b.dog_breed_group === group).attr('fill', 'orange');
    }
  }

  // Public redraw: re-bind data, recompute scales/axes, restyle selection
  function update(newData, state = {}) {
    // sync local with controller state (so click toggling works)
    selectedGroup = state.selectedGroup ?? null;

    // 1) scales
    x.domain([0, d3.max(newData, d => d.dog_count) || 0]).nice();
    y.domain(newData.map(d => d.dog_breed_group));

    // 2) axes
    xAxisG.transition().duration(250).call(d3.axisBottom(x));
    yAxisG.transition().duration(250).call(d3.axisLeft(y).tickSize(0));

    // 3) join
    bars = wireHandlers(
      gBars.selectAll('rect')
        .data(newData, d => d.dog_breed_group)
        .join(
          enter => enter.append('rect')
            .attr('x', 0)
            .attr('y', d => y(d.dog_breed_group))
            .attr('height', y.bandwidth())
            .attr('width', d => x(d.dog_count))
            .attr('fill', 'teal'),
          update => update,
          exit => exit.transition().duration(200).style('opacity', 0).remove()
        )
    );

    // 4) position/size + selection styling
    bars.transition().duration(250)
      .attr('y', d => y(d.dog_breed_group))
      .attr('height', y.bandwidth())
      .attr('width', d => x(d.dog_count))
      .attr('fill', d =>
        selectedGroup == null
          ? 'teal'
          : (d.dog_breed_group === selectedGroup ? 'orange' : 'teal')
      );
  }

  // Initial render
  update(data, { selectedGroup: null });

  // API
  return {
    on: (type, handler) => (dispatch.on(type, handler), undefined),
    update,
    highlightGroup
  };
}
