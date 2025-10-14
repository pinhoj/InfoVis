import {COLORS} from "../colors.js";
import { getGroup } from '../script.js';


const bins = 6;
const tilePadding = 0.08;
// expects D3 v6+ to be available (import * as d3 from 'd3')
export function createTileChart(container, data, state, filterState, {width, height, margin}){
  const dispatch = d3.dispatch('changeState');

  const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.right + margin.left)
      .attr('height', height + margin.top + margin.bottom)
      .attr('viewBox', `0 0 ${width + margin.right + margin.left} ${height + margin.top + margin.bottom}`);


  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const valueMax = d3.max(data, d => d.totalCount) ?? 0;
  
  const sqrtScale = d3.scaleSqrt()
          .domain([0, valueMax || 1])
          .range([0, 1]);

  const colorScale = d3
    .scaleSequential(d3.interpolate('#eeeeee', COLORS.base))
    .domain([0, valueMax || 1]); // avoid identical domain if all zeros


  // Create tiles
  const tileG = g.append('g').attr('class', 'tiles');

  
  let tiles = tileG
    .selectAll('rect.tile')
    .data(data)
    .join('rect')
    .attr('class', 'tile')
    .attr('transform', (d,i) =>`translate(${Math.floor(i / 5) * width/7},${ height * 0.15 + i % 5 * height/8})`)
    .attr('width', width / 7)
    .attr('height', height / 8)
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .attr('fill', d => colorScale(d.totalCount))
  
  const xLabels = Array.from(new Set(data.map(d => d.xBinLabel)));
  const yLabels = Array.from(new Set(data.map(d => d.yBinLabel)));

  const xScale = d3.scaleBand()
    .domain(xLabels)
    .range([0, width * 0.85]);

  const yScale = d3.scaleBand()
    .domain(yLabels)
    .range([0, height * 0.65]);

  let xAxis = g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(-2, ${height * 0.8})`)
    .call(d3.axisBottom(xScale).tickSizeInner(0).tickFormat(d=>`${formatRange(d)}`))
    
    
  xAxis.selectAll('text')
    .attr('dy', '0.8em')
    .attr('dx', '-0.4em')
    .style('text-anchor', 'middle');
    
    
  let yAxis = g.append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(-2, ${height * 0.15})`)
    .call(d3.axisLeft(yScale).tickSizeInner(0));

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

  // Axis labels
  let xTitle = g.append('text')
    .attr('class', 'x-label')
    .attr('transform', `translate(${width * 0.4},${height * 0.95}) `)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', 12)
    .text(state.x);

  let yTitle = g.append('text')
    .attr('class', 'y-label')
    .attr('transform', `translate(${-70},${height / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', 12)
    .text(state.y);


  let title = g.append('text')
    .attr('transform', `translate(${width *0.4 },0)`)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', 20)
    .style('font-weight', 'bold')
    .text("Dog Size vs Population Density");

  // --- 7) Legend (simple gradient)
  const legendHeight = 8;
  const legendWidth = width * 0.3;
  const legendX = width * 0.92;
  const legendY = height * 0.85;

  const legend = g.append('g').attr('class', 'legend');

  // Gradient
  const gradId = `grad-${Math.random().toString(36).slice(2)}`;

  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', gradId)
    .selectAll('stop')
    .data(d3.range(0, 1.0001, 0.1))
    .join('stop')
    .attr('offset', d => `${d * 100}%`)
    .attr('stop-color', d => colorScale(sqrtScale(d * valueMax)));

  legend
    .append('rect')
    .attr('x', legendX)
    .attr('y', legendY)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .attr('fill', `url(#${gradId})`)
    .attr('stroke', '#000')
    .attr('stroke-width', '0.8');

  // console.log(d3.format('.1~s')(valueMax));
  const legendScale = d3
    .scaleLinear()
    .domain([0, valueMax])
    .nice()
    .range([legendX, legendX + legendWidth]);

  let legendAxis = d3
    .axisBottom(legendScale)
    .ticks(3)
    .tickSize(4)
    .tickFormat(d3.format(".2~s"));
    
    let legendAxis2 = legend
    .append('g')
    .attr('transform', `translate(0,${legendY + legendHeight})`)
    .attr('stroke-width', '0.8')
    .call(legendAxis);

  legend
    .append('text')
    .attr('transform', `translate(0,${legendY + legendHeight})`)
    .attr('dominant-baseline', 'middle')
    .style('font-size', 11)


  const switchWidth = 40;
  const switchHeight = 20;
  const radius = switchHeight / 2 - 3;

  let isRightOn = false;  // false = left is on

  const toggle = svg.append("g")
    .attr("transform", `translate(${width}, ${10})`)
    .style("cursor", "pointer")
    .on("click", () => {
      isRightOn = !isRightOn;

      dispatch.call("changeState", null, {newState:
        {x: isRightOn ? "avg_age" : "population_density", y:state.y}});
        
      updateToggle();
    });

  // Track (background)
  const track = toggle.append("rect")
    .attr("width", switchWidth)
    .attr("height", switchHeight)
    .attr("rx", switchHeight / 2)
    .attr("fill", "#ccc");

  // Handle (knob)
  const handle = toggle.append("circle")
    .attr("cy", switchHeight / 2)
    .attr("r", radius + 2)
    .attr("cx", radius + 3)
    .attr("fill", "white")
    .attr("stroke", "#888");

  // Left label
  const leftLabel = svg.append("text")
    .attr("x", width - 8)
    .attr("y", switchHeight / 2 + 13)
    .attr("text-anchor", "end")
    .attr("font-size", 10)
    .text("Density");
    
    // Right label
    const rightLabel = svg.append("text")
    .attr("x", width + switchWidth + 8)
    .attr("y", switchHeight / 2 + 13)
    .attr("text-anchor", "start")
    .attr("font-size", 10)
    .text("Age");

  function updateToggle() {
    // Update track color
    track.transition()
      .duration(200)
      .attr("fill", isRightOn ? "#bbbbbb" : "#bbbbbb");

    // Move handle
    handle.transition()
      .duration(200)
      .attr("fill", COLORS.base)
      .attr("cx", isRightOn ? switchWidth - radius - 3 : radius + 3);

    // Highlight active label
    leftLabel
      .transition()
      .duration(200)
      .attr("fill", isRightOn ? "#999" : "#000")
      .attr("font-weight", isRightOn ? "normal" : "bold");

    rightLabel
      .transition()
      .duration(200)
      .attr("fill", isRightOn ? "#000" : "#999")
      .attr("font-weight", isRightOn ? "bold" : "normal");
  }

  updateToggle(); // Initial render

  const options = [
    { value: "dog_size", label: "Size" },
    { value: "adaptability", label: "Adaptability" },
    { value: "friendliness", label: "Friendliness" },
    { value: "health_needs", label: "Health Needs" },
    { value: "trainability", label: "Trainability" },
    { value: "exercise_needs", label: "Exercise Needs" }
  ];

  const startX = width * 0.92;
  const startY = margin.top + 30;
  const lineHeight = 15;
  const optionRadius = 4;

  const radioGroup = svg.append("g")
  .attr("id", "table-options");

// Track selected value
let selectedValue = null;

const optionGroups = radioGroup.selectAll("g.option")
  .data(options)
  .enter()
  .append("g")
  .attr("class", "option")
  .attr("transform", (d, i) => `translate(${startX}, ${startY + i * lineHeight})`)
  .style("cursor", "pointer")
  .on("click", function(event, d) {
    selectedValue = d.value;
    dispatch.call("changeState", null, {newState:
        {x: state.x, y:d.value}});
    updateSelection();
  });

  // Outer circle (radio ring)
  optionGroups.append("circle")
    .attr("r", optionRadius)
    .attr("stroke", "#333")
    .attr("fill", "#fff");

  // Inner circle (filled only if selected)
  optionGroups.append("circle")
    .attr("class", "radio-dot")
    .attr("r", optionRadius / 2)
    .attr("fill", "#333")
    .attr("visibility", "hidden");

  // Label text
  optionGroups.append("text")
    .attr("x", optionRadius * 2 + 5)
    .attr("y", 5)
    .text(d => d.label)
    .attr("font-size", 11)
    .attr("alignment-baseline", "middle");

  function updateSelection() {
    radioGroup.selectAll(".radio-dot")
      .attr("visibility", d => d.value === selectedValue ? "visible" : "hidden");
  }

  function formatRange(range){
    return `${d3.format("~s")(range.split('-')[0])}-${d3.format("~s")(range.split('-')[1])}`
  }
  // --- API

  function wireHandlers(sel) {
      sel
          .on('mouseover', function (event, d) {
              tooltip.transition().duration(150).style('opacity', 1);
              tooltip.html(`${state.x}: ${formatRange(d.xBinLabel)}
                          <br>${state.y}: ${d.yBinLabel}
                          <br>Dog count: ${d3.format('.3~s')(d.totalCount)}`);
              
          })
          .on('mousemove', function (event) {
              tooltip.style('left', (event.pageX + 10) + 'px')
                     .style('top', (event.pageY - 28) + 'px');
          })
          .on('mouseout', function (event, d) {
              tooltip.transition().duration(150).style('opacity', 0);
          })
          .on('click', function (event, d) {
              // 
          });
      return sel;
      }
      
      function update(newdata, newState, newFilterState){
          filterState = newFilterState;
          state = newState;
          console.log(newdata, newState);
          
          const valueMax = d3.max(newdata, d => d.totalCount) ?? 0;

          const sqrtScale = d3.scaleSqrt()
          .domain([0, valueMax || 1])
          .range([0, 1]);

          let baseColor = filterState.group != null ? COLORS[filterState.group].selected
                        : filterState.breed != null ? COLORS[getGroup(filterState.breed)].selected 
                        : COLORS.base 

          const newColorScale = d3.scaleSequential(d3.interpolate('#eeeeee', baseColor)); // avoid identical domain if all zeros

  
          tiles = wireHandlers(
              tileG.selectAll('rect.tile')
              .data(newdata)
              .join(
                  enter => enter
                    .append('rect')
                    .attr('fill', d => newColorScale(sqrtScale(d.totalCount))),
                  update => update
                      .transition()
                      .duration(500)
                      .attr('fill', d => 
                                  // if (selectedState.district === null)
                                      newColorScale(sqrtScale(d.totalCount))
                              ),
                  exit => exit.transition().duration(200).style('opacity', 0).remove()
              )
            )
          const xLabels = Array.from(new Set(newdata.map(d => d.xBinLabel)));
          const yLabels = Array.from(new Set(newdata.map(d => d.yBinLabel)));

          const xScale = d3.scaleBand()
            .domain(xLabels)
            .range([0, width * 0.86]);

          const yScale = d3.scaleBand()
            .domain(yLabels)
            .range([0, height * 0.65]);


          xAxis
            .call(d3.axisBottom(xScale).tickSizeInner(0).tickFormat(d=>`${formatRange(d)}`));
            
          xAxis.selectAll('text')
            .attr('dy', '0.8em')
            .attr('dx', '0em')
            .style('text-anchor', 'middle');

          yAxis
            .call(d3.axisLeft(yScale).tickSizeInner(0));

          handle.attr('fill', baseColor);

          gradient
            .attr('stop-color', d => newColorScale(sqrtScale(d * valueMax)));

          let legendScale = d3
            .scaleLinear()
            .domain([0, valueMax])
            .nice(3)
            .range([legendX, legendX + legendWidth]);

          legendAxis = d3
            .axisBottom(legendScale)
            .ticks(3)
            .tickSize(4)
            .tickFormat(d3.format(".2~s"));
            
  
          legendAxis2
            .call(legendAxis);

          xTitle.text(state.x);
          yTitle.text(state.y);

          title.text(state.x + " vs " + state.y);
          
      }
  // function update(newData, newState) {
  //   // Re-create chart with new data. For simplicity, full re-render:
  //   console.log("updating", newData, newState);
    
    // return createTileChart(container, newData, {
    //   bins,
    //   yBins: yBinsRequested,
    //   xField: filterState.tableMode,
    //   yField: filterState.tableOption,         // classes on Y
    //   valueField,
    //   width,
    //   height,
    //   margin,
    //   xLabel,
    //   yLabel,
    //   colorInterpolator,
    //   tilePadding,
    // });
  // }
  selectedValue = "dog_size";
  updateSelection();
  update(data, {x:"population_density",y:"dog_size"}, filterState);

  return {
        on: (type, handler) => (dispatch.on(type, handler), undefined),
        update,
    };
}
