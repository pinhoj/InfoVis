// expects D3 v6+ to be available (import * as d3 from 'd3')
import { COLORS } from '../colors.js';
import { getGroup } from '../script.js';


export function createTileChart(
  container,
  { tiles, xBins, yBins },
  filterState,
  {
    width = 720,
    height = 420,
    margin = { top: 84, right: 16, bottom: 48, left: 56 },
    colorInterpolator = d3.interpolateBlues,
    tilePadding = 0.08
  } = {}
) {
  let xField = 'population_density';
  let yField = 'adaptability';
  let selectedGroup = null;
  const dispatch = d3.dispatch('filter', 'hover');
  const valueField = 'dog_counts'
  const root =
    typeof container === 'string'
      ? d3.select(container)
      : d3.select(container);

  // Clear previous render (if any)
  root.selectAll('*').remove();

  // Build SVG & groups
  const svg = root
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img');

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // --- 4) Scales
  let xScale = d3
    .scaleBand()
    .domain(d3.range(xBins.length))
    .range([0, plotW])
    .padding(tilePadding);


  let yScale = d3
    .scaleBand()
    .domain(yBins.map(b => b.label))
    .range([plotH, 0])
    .padding(tilePadding);

  let valueMax = d3.max(tiles, d => d.value) ?? 0;

  let baseColor = selectedGroup === null ? COLORS : COLORS[selectedGroup]

  let color = d3.scaleSequential()
    .domain([0, valueMax || 1])
    .interpolator(d3.interpolate('#ffffff', baseColor.base));

  // --- 5) Axes
  let xAxis = d3
    .axisBottom(xScale)
    .tickFormat(i => xBins[i]?.label ?? `Bin ${i + 1}`)
    .tickSizeOuter(0);

  let yAxis = d3.axisLeft(yScale).tickSizeOuter(0);

  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .attr('class', 'x-axis')
    .call(xAxis)
    .selectAll('text')
    .attr('dy', '1em')
    .attr('dx', '0.8em')
    .style('text-anchor', 'start')
    .style('font-size', '14px')


    // .attr('transform', 'rotate(20)')

    g.append('g').attr('class', 'y-axis').call(yAxis).style('font-size', '14px');
    

  // Axis labels
  g.append('text')
    .attr('class', 'x-label')
    .attr('x', plotW / 2)
    // push the x-axis label further down so it doesn't collide with rotated ticks
    .attr('y', plotH + 40)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', '14px')
    .text(xField);

  g.append('text')
    .attr('class', 'y-label')
    // move the y-axis label left so it clears the tick labels
    .attr('transform', `translate(${-80},${plotH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', '14px')
    .text(yField);

  // --- Tooltip (custom, immediate) - follow breedChart pattern
  const tooltip = d3.select('body')
    .selectAll('.tooltip-tile')
    .data([null])
    .join('div')
    .attr('class', 'tooltip-tile')
    .style('position', 'absolute')
    .style('background', 'white')
    .style('border', '1px solid #ccc')
    .style('padding', '6px 8px')
    .style('border-radius', '6px')
    .style('box-shadow', '0 2px 6px rgba(0,0,0,0.15)')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  // --- 6) Tiles
  const tileG = g.append('g').attr('class', 'tiles');

  const rects = tileG
    .selectAll('rect.tile')
    .data(tiles, d => `${d.y}|${d.xIndex}`)
    .join('rect')
    .attr('class', 'tile')
    .attr('x', d => xScale(d.xIndex))
    .attr('y', d => yScale(d.y))
    .attr('width', xScale.bandwidth())
    .attr('height', yScale.bandwidth())
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .attr('fill', d => color(d.value))
    .style('cursor', 'pointer')
    .on('mouseenter', (event, d) => {
      const bin = xBins[d.xIndex];
      tooltip.transition().duration(80).style('opacity', 1);
      tooltip.html(`
        <strong>${yField}:</strong> ${d.y}<br/>
        <strong>${xField}:</strong> ${bin?.label ?? ''}<br/>
        <strong>${valueField} (sum):</strong> ${d.value}<br/>
        <strong>rows:</strong> ${d.count}
      `);
      tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 28) + 'px');

      dispatch.call('hover', null, {
        y: d.y,
        xIndex: d.xIndex,
        xRange: [bin?.x0, bin?.x1],
        value: d.value,
        count: d.count,
      });
      d3.select(event.currentTarget).attr('stroke', '#222');
    })
    .on('mousemove', (event) => {
      tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseleave', (event, d) => {
      tooltip.transition().duration(80).style('opacity', 0);
      dispatch.call('hover', null, null);
      d3.select(event.currentTarget).attr('stroke', '#fff');
    })
    .on('click', (event, d) => {
      const bin = xBins[d.xIndex];
      dispatch.call('filter', null, {
        y: d.y,
        xIndex: d.xIndex,
        xRange: [bin?.x0, bin?.x1],
        value: d.value,
        count: d.count,
      });
    });

  // --- 7) Legend (simple gradient)
  const legendHeight = 10;
  const legendWidth = Math.min(240, plotW);
  const legendX = (plotW - legendWidth) / 2;
  const legendY = -40;

  const legend = g.append('g').attr('class', 'legend');

  // Gradient
  const defs = svg.append('defs');
  let gradId = `grad-${Math.random().toString(36).slice(2)}`;
  let gradient = defs.append('linearGradient').attr('id', gradId);
  gradient
    .selectAll('stop')
    .data(d3.range(0, 1.0001, 0.1))
    .join('stop')
    .attr('offset', d => `${d * 100}%`)
    .attr('stop-color', d => color(d * valueMax));

  legend
    .append('rect')
    .attr('x', legendX)
    .attr('y', legendY)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .attr('fill', `url(#${gradId})`)
    .attr('stroke', '#ccc')
    .attr('data-grad', gradId);

  const legendScale = d3
    .scaleLinear()
    .domain([0, valueMax])
    .range([legendX, legendX + legendWidth]);

  const legendAxis = d3
    .axisBottom(legendScale)
    .ticks(5)
    .tickSize(legendHeight + 4);



  legend
    .append('g')
    .attr('transform', `translate(0,${legendY})`)
    .call(legendAxis)
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('line').attr('y2', 0));

  legend
    .append('text')
    .attr('x', legendX + legendWidth + 6)
    .attr('y', legendY + legendHeight / 2)
    .attr('dominant-baseline', 'middle')
    .style('font-size', 11)
    .text(`${valueField} (sum)`);

  // --- API
  function update({ tiles, xBins, yBins }, filterState) {
    const newtiles = tiles;
    const newxBins = xBins;
    const newyBins = yBins;
    yField = filterState.tableOption;
    xField = filterState.tableMode;
    const selectedGroup = filterState.group === null ? getGroup(filterState.breed) : filterState.group;

    xScale = d3
      .scaleBand()
      .domain(d3.range(newxBins.length))
      .range([0, plotW])
      .padding(tilePadding);


    yScale = d3
      .scaleBand()
      .domain(newyBins.map(b => b.label))
      .range([plotH, 0])
      .padding(tilePadding);




    valueMax = d3.max(newtiles, d => d.value) ?? 0;

    baseColor = selectedGroup === null ? COLORS : COLORS[selectedGroup]

    color = d3.scaleSequential()
      .domain([0, valueMax || 1])
      .interpolator(d3.interpolate('#ffffff', baseColor.base));

    // --- 5) Axes
    xAxis = d3
      .axisBottom(xScale)
      .tickFormat(i => newxBins[i]?.label ?? `Bin ${i + 1}`)
      .tickSizeOuter(0);

    yAxis = d3.axisLeft(yScale).tickSizeOuter(0);

    g.select('.x-label').text(xField);
    g.select('.y-label').text(yField);

    g.select('.y-axis')
      .transition()
      .duration(750)
      .call(yAxis);

    g.select('.x-axis')
      .transition()
      .duration(750)
      .call(xAxis);

    //clear out tiles and redraw
    tileG.selectAll('*').remove();

    tileG.append('g').attr('class', 'tiles');

    const rects = tileG
      .selectAll('rect.tile')
      .data(newtiles, d => `${d.y}|${d.xIndex}`)
      .join('rect')
      .attr('class', 'tile')
      .attr('x', d => xScale(d.xIndex))
      .attr('y', d => yScale(d.y))
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('fill', d => color(d.value))
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const bin = newxBins[d.xIndex];
        tooltip.transition().duration(80).style('opacity', 1);
        tooltip.html(`
        <strong>${yField}:</strong> ${d.y}<br/>
        <strong>${xField}:</strong> ${bin?.label ?? ''}<br/>
        <strong>${valueField} (sum):</strong> ${d.value}<br/>
        <strong>rows:</strong> ${d.count}
      `);
        tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 28) + 'px');

        dispatch.call('hover', null, {
          y: d.y,
          xIndex: d.xIndex,
          xRange: [bin?.x0, bin?.x1],
          value: d.value,
          count: d.count,
        });
        d3.select(event.currentTarget).attr('stroke', '#222');
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseleave', (event, d) => {
        tooltip.transition().duration(80).style('opacity', 0);
        dispatch.call('hover', null, null);
        d3.select(event.currentTarget).attr('stroke', '#fff');
      })
      .on('click', (event, d) => {
        const bin = newxBins[d.xIndex];
        dispatch.call('filter', null, {
          y: d.y,
          xIndex: d.xIndex,
          xRange: [bin?.x0, bin?.x1],
          value: d.value,
          count: d.count,
        });
      });


    // update legend
    g.select('.legend g')
      .transition().duration(750)
      .call(d3.axisBottom(d3.scaleLinear().domain([0, valueMax]).range([legendX, legendX + legendWidth]))
        .ticks(5).tickSize(legendHeight + 4))
      .call(s => s.select('.domain').remove())
      .call(s => s.selectAll('line').attr('y2', 0));

  const gradId = g.select('.legend rect').attr('fill').match(/url\(#(.+)\)/)[1];
d3.select(`#${gradId}`).selectAll('stop')
  .attr('stop-color', (_, i, nodes) => {
    const t = (nodes.length === 1) ? 0 : i / (nodes.length - 1);
    return color(t * valueMax);
  });




  }


  function destroy() {
    root.selectAll('*').remove();
  }

  // Expose dispatcher so user code can do:
  // chart.on('hover', cb) and chart.on('filter', cb)
  function on(type, callback) {
    dispatch.on(type, callback);
    return api;
  }

  const api = { update, destroy, on };
  return api;
}
