// expects D3 v6+ to be available (import * as d3 from 'd3')
import { COLORS } from '../colors.js';
import { getGroup } from '../script.js';

export function createTileChart(
  container,
  data = [],
  {
    bins = 6,
    yBinsRequested = 5,
    xField = 'population_density',         // binned on X
    // xField = 'avg_age',         // binned on X
    yField = 'adaptability',    // classes on Y
    valueField = 'dog_count',   // summed per tile
    width = 720,
    height = 420,
    margin = { top: 64, right: 16, bottom: 48, left: 56 },
    xLabel = xField,
    yLabel = yField,
    colorInterpolator = d3.interpolateBlues,
    tilePadding = 0.08,
    selectedGroup = null,
  } = {}
) {
  const dispatch = d3.dispatch('filter', 'hover');
  console.log('data', data);

  // Resolve container to a selection
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

  // --- Helpers
  const num = v => (v == null || v === '' ? NaN : +v);

  // --- 1) Prepare Y domain (classes) and numeric binning (always 5 bins)
const yRaw = data.map(d => d[yField]).filter(v => v != null);
const isYNumeric = yRaw.every(v => !isNaN(num(v)));

let yDomain;
let yBinObjs = null;

// Always bin into 5 bins if numeric
if (isYNumeric) {
  console.log('yField is numeric, binning into', yBinsRequested, 'bins');
  const yValues = data.map(d => num(d[yField])).filter(v => isFinite(v));
  const yExtent = d3.extent(yValues);
  const yPad = yExtent[0] === yExtent[1] ? 0.5 : 0;

  const yBinGen = d3
    .bin()
    .value(d => num(d[yField]))
    .domain([yExtent[0] - yPad, yExtent[1] + yPad])
    .thresholds(5);

  const yBinned = yBinGen(data);
  console.log('yBinned', yBinned);
  yBinObjs = yBinned.map((bin, i) => {
    const y0 = bin.x0 ?? NaN;
    const y1 = bin.x1 ?? NaN;
    const label = isFinite(y0) && isFinite(y1) ? `${d3.format('.1f')(y0)}–${d3.format('.1f')(y1)}` : YBin `$"{i + 1}`;
    return { i, y0, y1, label, rows: bin };
  });

  yDomain = yBinObjs.map(b => b.label);
} else {
  // fallback: treat as categorical if non-numeric
  const uniq = Array.from(new Set(yRaw));
  yDomain = uniq.sort((a, b) => d3.ascending(String(a), String(b)));
}

  // --- 2) Build X bins for xField
  const xValues = data.map(d => num(d[xField])).filter(v => isFinite(v));
  const xExtent = d3.extent(xValues);
  // Guard: if not enough variation, widen slightly to avoid empty bins
  const pad = xExtent[0] === xExtent[1] ? 0.5 : 0;
  const binGen = d3
    .bin()
    .value(d => num(d[xField]))
    .domain([xExtent[0] - pad, xExtent[1] + pad])
    .thresholds(bins);

  const binned = binGen(data);

  // Create an index so we can quickly map a datum to its bin index
  // (binned[i] is an array of original data rows in that bin)
  // We will also build human-readable bin labels.
  const xBins = binned.map((bin, i) => {
    const x0 = bin.x0 ?? NaN;
    const x1 = bin.x1 ?? NaN;
    const label =
      isFinite(x0) && isFinite(x1)
        ? `${d3.format('.3~s')(x0)}–${d3.format('.3~s')(x1)}`
        : `Bin ${i + 1}`;
    return { i, x0, x1, label, rows: bin };
  });

  // Map from datum -> bin index
  const datumToBinIndex = d => {
    // Find the bin whose [x0, x1) contains this datum's x
    const v = num(d[xField]);
    // Handle edge case where v == last bin's x1: include in last bin
    for (let i = 0; i < xBins.length; i++) {
      const { x0, x1 } = xBins[i];
      if (v >= x0 && v < x1) return i;
      if (i === xBins.length - 1 && v === x1) return i;
    }
    return null;
  };

  // Map a datum to the Y label used in tiles. Handles 'adaptability' specially.
  const datumToYLabel = d => {
    if (yBinObjs) {
      const v = num(d[yField]);
      for (let i = 0; i < yBinObjs.length; i++) {
        const { y0, y1, label } = yBinObjs[i];
        if (v >= y0 && v < y1) return label;
        if (i === yBinObjs.length - 1 && v === y1) return label;
      }
      return null;
    }
    // otherwise return the raw value (string or number)
    return d[yField];
  };

  // --- 3) Aggregate into tiles: for each (yClass, xBin) sum valueField
  const tileMap = new Map(); // key `${y}|${xIndex}` -> {y, xIndex, value}
  const ensureTile = (y, xIndex) => {
    const k = `${y}|${xIndex}`;
    if (!tileMap.has(k)) tileMap.set(k, { y, xIndex, value: 0, count: 0 });
    return tileMap.get(k);
  };

  for (const d of data) {
    const yKey = datumToYLabel(d);
    const xIndex = datumToBinIndex(d);
    if (yKey == null || xIndex == null) continue;
    const v = num(d[valueField]);
    if (!isFinite(v)) continue;
    const cell = ensureTile(yKey, xIndex);
    cell.value += v;
    cell.count += 1;
  }

  // Fill in missing combinations with zero-value tiles
  for (const y of yDomain) {
    for (let i = 0; i < xBins.length; i++) {
      const k = `${y}|${i}`;
      if (!tileMap.has(k)) tileMap.set(k, { y, xIndex: i, value: 0, count: 0 });
    }
  }

  const tiles = Array.from(tileMap.values());

  // --- 4) Scales
  const xScale = d3
    .scaleBand()
    .domain(d3.range(xBins.length))
    .range([0, plotW])
    .padding(tilePadding);

  const yScale = d3
    .scaleBand()
    .domain(yDomain)
    .range([plotH, 0])
    .padding(tilePadding);

  const valueMax = d3.max(tiles, d => d.value) ?? 0;
  // Choose a base color matching choropleth logic: group > breed->group > base
console.log("selectedGroup", selectedGroup);

const  baseColor = selectedGroup === null ? COLORS : COLORS[selectedGroup] 

  console.log("baseColor", baseColor);


  const color = d3.scaleSequential()
    .domain([0, valueMax || 1])
    .interpolator(d3.interpolate('#ffffff', baseColor.base));

  // --- 5) Axes
  const xAxis = d3
    .axisBottom(xScale)
    .tickFormat(i => xBins[i]?.label ?? `Bin ${i + 1}`)
    .tickSizeOuter(0);

  const yAxis = d3.axisLeft(yScale).tickSizeOuter(0);

  g.append('g')
    .attr('transform', `translate(0,${plotH})`)
    .attr('class', 'x-axis')
    .call(xAxis)
    .selectAll('text')
    .attr('dy', '0.8em')
    .attr('dx', '-0.4em')
    .attr('transform', 'rotate(20)')
    .style('text-anchor', 'start');

  g.append('g').attr('class', 'y-axis').call(yAxis);

  // Axis labels
  g.append('text')
    .attr('class', 'x-label')
    .attr('x', plotW / 2)
    // push the x-axis label further down so it doesn't collide with rotated ticks
    .attr('y', plotH + 64)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', 12)
    .text(xLabel);

  g.append('text')
    .attr('class', 'y-label')
    // move the y-axis label left so it clears the tick labels
    .attr('transform', `translate(${-56},${plotH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', 12)
    .text(yLabel);

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
      // show custom tooltip immediately
      tooltip.transition().duration(80).style('opacity', 1);
      tooltip.html(`
        <strong>${yLabel}:</strong> ${d.y}<br/>
        <strong>${xLabel}:</strong> ${bin?.label ?? ''}<br/>
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
  const legendY = -20;

  const legend = g.append('g').attr('class', 'legend');

  // Gradient
  const defs = svg.append('defs');
  const gradId = `grad-${Math.random().toString(36).slice(2)}`;
  const gradient = defs.append('linearGradient').attr('id', gradId);
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
    .attr('stroke', '#ccc');

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
  function update(newData = data, filterState = {}) {
    // Re-create chart with new data. For simplicity, full re-render:
    console.log("updading", filterState);
    svg.remove();
    return createTileChart(container, newData, {
      bins,
      yBins: yBinsRequested,
      xField: filterState.tableMode,
      yField: filterState.tableOption,         // classes on Y
      valueField,
      width,
      height,
      margin,
      xLabel,
      yLabel,
      colorInterpolator,
      tilePadding,
      selectedGroup : filterState.group === null ? getGroup(filterState.breed) : filterState.group,
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
