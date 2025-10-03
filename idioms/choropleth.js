import {COLORS} from '../colors.js'

export function createChoropleth(container, data, geodata, {width, height, margin}){

    const svg = d3.select(container)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        
        
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const projection = d3.geoIdentity()
        .reflectY(true)
        .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], geodata);
    
    const path = d3.geoPath().projection(projection);
    
    g.selectAll('path')
        .data(geodata.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', 'teal')
        .attr('stroke', '#333')
        .attr('stroke-width', 1)

    // Tooltip (scoped; avoid duplicates by selecting or creating)
    const tooltip = d3.select('body').selectAll('.tooltip-map').data([null]).join('div')
        .attr('class', 'tooltip-map')
        .style('position', 'absolute')
        .style('background', 'white')
        .style('border', '1px solid #ccc')
        .style('padding', '6px 10px')
        .style('border-radius', '6px')
        .style('box-shadow', '0 2px 6px rgba(0,0,0,0.2)')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0);

    
    let districts = g.selectAll('path');


    // Attach handlers to a selection (both enter & update)
    function wireHandlers(sel) {
    sel
        .on('mouseover', function (event, d) {
            console.log(d);
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(`District ${d.properties.iso.toString().slice(1,3)} <br>Name: ${d.properties.name}`);
        // if (selectedGroup === null) {
        //     d3.select(this).attr('fill',COLORS.hover);
        //     dispatch.call('hover', null, { dog_breed_group: d.dog_breed_group });
        // }
        })
        .on('mousemove', function (event) {
        tooltip.style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function () {
        tooltip.transition().duration(150).style('opacity', 0);

        // d3.select(this).attr('fill',
        //     selectedGroup != null ? COLORS.selected : COLORS.base
        // );
        // dispatch.call('hover', null, { dog_breed_group: null });
        })
        .on('click', function (event, d) {
        // Toggle next selection relative to current controller-driven state
        // const next = (selectedGroup === d.dog_breed_group) ? null : d.dog_breed_group;
        // // Publish semantic filter event (controller will recompute + call update)
        // dispatch.call('filter', null, { dog_breed_group: next });
        // dispatch.call('hover', null, { dog_breed_group: null });
        });
    return sel;
    }
    
    function update(data){
        districts = wireHandlers(
            g.selectAll('path')
            .data(geodata.features)
            .join(
                enter => enter.append('path')
                    .attr('fill', COLORS.base),
                update => update,
                exit => exit.transition().duration(200).style('opacity', 0).remove()
            ))
    }

    function hoverDistrict(district){
        districts.filter(d =>d.code === district.code).attr('fill', 'red')
    }

    function highlightDistrict(district){

    }

    // Initial render
    update(data);

    // API
    return {
        on: (type, handler) => (dispatch.on(type, handler), undefined),
        update,
        hoverDistrict,
        highlightDistrict
    };
}