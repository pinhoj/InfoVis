import {COLORS} from '../colors.js'
import { getGroup } from '../script.js';

export function createChoropleth(container, geodata, selectedState, {width, height, margin}){
    const dispatch = d3.dispatch('filter');
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        
    
    const counts = geodata.features.map(d => d.properties.dog_density);

    const colorScale = d3.scaleSequential()
        .domain([d3.min(counts), d3.max(counts)])  // or [0, d3.max(counts)] if you want
        .interpolator(d3.interpolate('#ffffff', 
            selectedState.group != null ? COLORS[selectedState.group].base
            : selectedState.breed != null ? COLORS[getGroup(selectedState.breed)].base
            : COLORS.base )); 

        
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let projection = d3.geoIdentity()
        .reflectY(true)
        .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], geodata);
    
    let path = d3.geoPath().projection(projection);
    
    g.selectAll('path')
        .data(geodata.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', d => colorScale(d.properties.dog_density))
        .attr('stroke', '#333')
        .attr('stroke-width', 1)

    // Title
    const title = svg.append("text")
        .attr("x", width / 4)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .text("Dogs");
        
    svg.append("text")
        .attr("x", width / 4)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .text("per 1000 people in Vienna");

    // color scale
    const legendWidth = 120;
    const legendHeight = 10;

    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "legend-gradient");

    // determine color based on selectedState
    const legendColor = selectedState.group != null ? COLORS[selectedState.group].base
        : selectedState.breed != null ? COLORS[getGroup(selectedState.breed)].base
        : COLORS.base;

    linearGradient.selectAll("stop")
        .data([
            {offset: "0%", color: "#ffffff"},
            {offset: "100%", color: legendColor}
        ])
        .enter()
        .append("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color);

    // Slightly shifted left (previously width / 4 - legendWidth / 2)
    const legendGroup = svg.append("g")
        .attr("transform", `translate(${width / 4 - legendWidth * 0.65}, ${35})`);

    legendGroup.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)")
        .style("stroke", "#ccc")
        .style("stroke-width", "0.5px");

    // Add legend axis
    const legendScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(4)
        .tickFormat(d3.format(".1f"));

    legendGroup.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis)
        .selectAll("text")
        .style("font-size", "8px");


    // Tooltip (scoped; avoid duplicates by selecting or creating)
    const tooltip = d3.select('body').selectAll('.tooltip-map').data([null]).join('div')
        .attr('class', 'tooltip-map')
        .style('position', 'absolute')
        .style('background', 'white')
        .style('border', '1px solid #ccc')
        .style('z-index', '10')
        .style('padding', '6px 10px')
        .style('border-radius', '6px')
        .style('width', '15%')
        .style('box-shadow', '0 2px 6px rgba(0,0,0,0.2)')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0);

        
    let districts = g.selectAll('path');


    // Attach handlers to a selection (both enter & update)
    function wireHandlers(sel) {
    sel
        .on('mouseover', function (event, d) {
            tooltip.transition().duration(150).style('opacity', 1);
            tooltip.html(`District ${d.properties.iso.toString().slice(1,3)} 
                        <br>Name: ${d.properties.name}
                        <br>Dogs per 1000 people: ${d3.format('.3~s')(d.properties.dog_density)}
                        <br>Dog count: ${d3.format('.3~s')(d.properties.totalDogs)}`);
        
        })
        .on('mousemove', function (event) {
            tooltip.style('left', (event.pageX + 10) + 'px')
                   .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function () {
            tooltip.transition().duration(150).style('opacity', 0);
        })
        .on('click', function (event, d) {
            console.log(selectedState.postcode , d.properties.iso)
            const next = (selectedState.postcode === d.properties.iso) ? null : d.properties.iso;
            dispatch.call('filter', null, { district: next });
        });
    return sel;
    }
    
    function update(newdata, newState= {}){
        selectedState = newState;
        
        const counts = newdata.features.map(d => d.properties.dog_density);

        const newcolorScale = d3.scaleSequential()
            .domain([d3.min(counts), d3.max(counts)])  // or [0, d3.max(counts)] if you want
            .interpolator(d3.interpolate('#ffffff', 
                selectedState.group != null ? COLORS[selectedState.group].selected
                : selectedState.breed != null ? COLORS[getGroup(selectedState.breed)].selected 
                : COLORS.base )); 

        console.log(newcolorScale.domain());

        projection = d3.geoIdentity()
        .reflectY(true)
        .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], newdata);
    
        path = d3.geoPath().projection(projection);

        districts = wireHandlers(
            g.selectAll('path')
            .data(newdata.features, d=>d.properties)
            .join(
                enter => enter
                    .append('path')
                    .attr('d', path)
                    .attr('fill', d => newcolorScale(d.properties.dog_density))
                    .attr('stroke', '#333')
                    .attr('stroke-width', 1)),
                update => update
                    .attr('d', path)
                    .attr('class', d => d === selectedState.district ? 'glow' : null)
                    .attr('fill', d => {
                                if (selectedState.district === null)
                                    newcolorScale(d.properties.dog_density);
                            }),
                exit => exit.transition().duration(200).style('opacity', 0).remove()
            )

        // ===== Update legend dynamically =====
        const newLegendColor = selectedState.group != null ? COLORS[selectedState.group].selected
            : selectedState.breed != null ? COLORS[getGroup(selectedState.breed)].selected
            : COLORS.base;

        linearGradient.selectAll("stop")
            .data([
                {offset: "0%", color: "#ffffff"},
                {offset: "100%", color: newLegendColor}
            ])
            .join("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);

        const newLegendScale = d3.scaleLinear()
            .domain(newcolorScale.domain())
            .range([0, legendWidth]);

        legendGroup.select("g")
            .call(d3.axisBottom(newLegendScale).ticks(4).tickFormat(d3.format(".1f")))
            .selectAll("text")
            .style("font-size", "8px");

        if (selectedState.breed != null)
            title.text(selectedState.breed + "s");
        else if (selectedState.group != null)
            title.text(selectedState.group);
        else
            title.text("Dogs");
    }

    function hoverDistrict(district){
        districts.filter(d =>d.code === district.code).attr('fill', 'red')
    }

    function highlightDistrict(district){

    }

    // Initial render
    update(geodata);

    // API
    return {
        on: (type, handler) => (dispatch.on(type, handler), undefined),
        update,
        hoverDistrict,
        highlightDistrict
    };
}
