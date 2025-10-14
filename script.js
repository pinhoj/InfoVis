// main.js
// Loads CSV, keeps global filter state, recomputes aggregates,
// and updates ALL charts when the group filter changes.

import { createBreedChart } from './idioms/breedChart.js';
import { createGroupChart } from './idioms/groupChart.js';
import { createChoropleth } from './idioms/choropleth.js';
import { createTileChart } from './idioms/tileChart.js';

// ---- config ----
const margin = { top: 10, right: 10, bottom: 10, left: 140 };
const width  = window.innerWidth * 0.4 - margin.left - margin.right;
let height = window.innerHeight * 0.4 - margin.top - margin.bottom;

// ---- state ----
let rows = [], geodata= {};
let breedToGroup;
let filterState = {
  postcode: null,
  breed: null,
  group: null,
  // table controls from #chart4
  tableMode: 'population_density',
  tableOption: 'adaptability',
};

function renderFilterDisplay(filterState) {
  const container = d3.select('#filter-display');

  container.selectAll('*').remove();

  container.append('h3').text('Filters selected');

  const filters = [
    ["District", filterState.postcode != null ? getDistrict(filterState.postcode) : 'All'],
    ["Breed", filterState.breed || 'All'],
    ["Group", filterState.group || 'All'],
    // ["Table Mode", filterState.tableMode || 'All'],
    // ["Table Option", filterState.tableOption || 'None'],
  ];

  // console.log();
  
  const table = container.append('table');

  const rows = table.selectAll('tr')
    .data(filters)
    .enter()
    .append('tr');

  rows.append('td')
    .style('font-weight', 'bold')
    .text(([d]) => d + ':');

  rows.append('td')
    .text(([_,d]) => d);
  
}

// ---- data helpers ----
function getBreedFilteredRows() {
  return rows.filter(r =>
    (!filterState.postcode || r.district_code === filterState.postcode) &&
    (!filterState.group    || r.dog_breed_group === filterState.group)
  );
}

function getGroupFilteredRows(){
  return rows.filter(r =>
    (!filterState.postcode || r.district_code === filterState.postcode)
  );
}

function filteredRows() {
  return rows.filter(r =>
    (!filterState.postcode || r.district_code === filterState.postcode) &&
    (!filterState.breed || r.dog_breed === filterState.breed) &&
    (!filterState.group    || r.dog_breed_group === filterState.group)
  );
}

function getGeoFilteredRows() {
  const filtered = rows.filter(r =>
    (!filterState.breed || r.dog_breed === filterState.breed) &&
    (!filterState.group || r.dog_breed_group === filterState.group)
  );

 
  const dataByDistrict = d3.group(filtered, d => d.district_code);

    const mergedFeatures = geodata.features.map(feature => {
      const iso = feature.properties.iso;
      const dogData = dataByDistrict.get(iso) || [];

      const totalDogs = d3.sum(dogData, d => d.dog_count);
      const dogDensity = d3.sum(dogData, d => d.dog_density);

      feature.properties.totalDogs = totalDogs;
      feature.properties.dog_density = dogDensity;
      return feature;
    })
    return mergedFeatures;
}

function rollupBreeds(srcRows) {
  const byBreed = d3.rollup(
    srcRows,
    v => d3.sum(v, d => d.dog_count),
    d => d.dog_breed
  );
  breedToGroup = new Map(srcRows.map(d => [d.dog_breed, d.dog_breed_group]));
  const arr = Array.from(byBreed, ([dog_breed, dog_count]) => ({
    dog_breed,
    dog_breed_group: breedToGroup.get(dog_breed),
    dog_count
  })).sort((a, b) => d3.descending(a.dog_count, b.dog_count));
  return arr;
}

export function getGroup(breed){
  if(!breed) return null;
  return breedToGroup.get(breed);
}

export function getDistrict(postcode){
  if (Object.keys(geodata).length === 0) return;
  return geodata.features.find(f=>f.properties.iso === postcode).properties.name;
}

function rollupGroups(srcRows) {
  const byGroup = d3.rollup(
    srcRows,
    v => d3.sum(v, d => d.dog_count),
    d => d.dog_breed_group
  );
  const arr = Array.from(byGroup, ([dog_breed_group, dog_count]) => ({
    dog_breed_group,
    dog_count
  })).sort((a, b) => d3.descending(a.dog_count, b.dog_count));
  return arr;
}

function calculateTileChartData(data, yField = 'adaptability', xField='population_density') {
  console.log("calculating tile chart data for", data.length, "rows", "with yField " , yField, xField, "and xField", xField);
  const yBinsRequested = 5;
  const bins = 6;
  
  let valueField = 'dog_count';

  const num = v => (v == null || v === '' ? NaN : +v);

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
    console.log('binned', binned)
  
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

    console.log('xBins', xBins)
    console.log('xField', xField)
  
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
      // console.log('yKey',yKey,  'xIndex',xIndex, "num", num(d[valueField]))
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
    console.log(tileMap)
    console.log('yDoamin',yDomain)
  
    const tiles = Array.from(tileMap.values());
    console.log("tiles", tiles)
    return {tiles : tiles, xBins: xBins, yBins: yBinObjs}

}

// ---- charts (created after data load) ----
let breedChart, groupChart, choropleth, tileChart;

// ---- controller ----
function recomputeAndRender() {
  const breedFiltered = getBreedFilteredRows();
  const groupFiltered = getGroupFilteredRows();
  const breedsAll = rollupBreeds(breedFiltered);
  const topBreeds = breedsAll.slice(0, 10);
  const filtered = filteredRows();
  const tileChartData = calculateTileChartData(filtered, filterState.tableOption, filterState.tableMode);
  console.log("tilechartdata2",tileChartData);

  const groups = rollupGroups(groupFiltered).slice(0, 6);

  breedChart.update(topBreeds, filterState);
  groupChart.update(groups, filterState);
  choropleth.update({type:"FeatureCollection", features:getGeoFilteredRows()}, filterState)
  tileChart.update(tileChartData, filterState);

  renderFilterDisplay(filterState);
  // TODO: add chart1 update for postcode filter
}

// ---- boot ----
d3.csv('data/dogs_in_vienna.csv', d => ({
  district_code: +d.district_code,
  dog_breed: d.dog_breed,
  dog_breed_group: d.dog_breed_group,
  dog_count: +d.dog_count,
  dog_density: +d.dog_density,
  adaptability: +d.adaptability,
  population_density: +d.population_density,
  avg_age: +d.avg_age,
  avg_age: +d.avg_age,
  avg_age: +d.avg_age,
  avg_age: +d.avg_age,
  avg_age: +d.avg_age,
  avg_age: +d.avg_age,
  friendliness: +d.friendliness,
  health_needs: +d.health_needs,
  trainability: +d.trainability,
  exercise_needs: +d.exercise_needs,
  dog_size: +d.dog_size,
})).then(data => {
  rows = data.filter(d => d.dog_breed !== "Unknown");

  // initial aggregates
  const breedsAll = rollupBreeds(rows);
  const topBreeds = breedsAll.slice(0, 10);
  const groups    = rollupGroups(rows).slice(0, 6);
  const tiles = calculateTileChartData(rows);

  // create charts
  d3.json('geodata/vienna_districts.json').then(data => {
    geodata = data;

    choropleth = createChoropleth('#chart1', 
        {type: 'FeatureCollection', features: getGeoFilteredRows()}, 
        {breed:null, group:null, district:null}, 
        {width, height, margin:{top:0,bottom:0, left:0, right:0}}
      );

    choropleth.on('filter', ({ district }) => {
      filterState = {
        postcode: district || null,
        breed: null,
        group: filterState.group,
      tableMode: filterState.tableMode,
      tableOption: filterState.tableOption, 
      }
      recomputeAndRender();
    });
  })

  breedChart = createBreedChart('#chart2', topBreeds, { width, height, margin });
  height = (window.innerHeight * 0.25) - margin.top - margin.bottom;
  groupChart = createGroupChart('#chart3', groups,    { width, height, margin });
  // TODO: create postcode chart for #chart1


  breedChart.on('filter', ({ dog_breed }) => {
    console.log('breed filter event', dog_breed);
    filterState = {
      postcode: null,
      breed: dog_breed || null,
      group: filterState.group,
      tableMode: filterState.tableMode,
      tableOption: filterState.tableOption, 
    };
    recomputeAndRender();
  });


  groupChart.on('filter', ({ dog_breed_group }) => {
    filterState = {
      postcode: filterState.postcode,
      breed: null,
      group: dog_breed_group || null,
      tableMode: filterState.tableMode,
      tableOption: filterState.tableOption, 

    };
    recomputeAndRender();
  });

  breedChart.on("hover", ({ dog_breed_group }) => {
    groupChart.hoverGroup(dog_breed_group);
  });


  groupChart.on("hover", ({ dog_breed_group }) => {
    breedChart.hoverByGroup(dog_breed_group);
  });

  // compute a container-aware size for the tile chart so labels/tiles have more room
  const chart4El = document.querySelector('#chart4');
  let tileWidth = width;
  let tileHeight = Math.max(360, height); // ensure a minimum height
  const tileMargin = { top: 48, right: 16, bottom: 72, left: 72 };
  if (chart4El) {
    const rect = chart4El.getBoundingClientRect();
    tileWidth = Math.max(480, rect.width - 24);
    tileHeight = Math.max(360, rect.height - 40);
  }

  console.log('Object in Script:' , tiles)

  tileChart = createTileChart('#chart4', tiles, filterState, {
    width: tileWidth,
    height: tileHeight,
    margin: tileMargin,
  });

  tileChart.on('filter', ({ category, attribute }) => {
    console.log('tile filter event', category, attribute);
  });
  
  // Wire the table header controls (mode + options) to the central filterState
  function wireTableControls(){
    const modeInputs = document.querySelectorAll('input[name="table-mode"]');
    modeInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        if (e.target.checked) {
          filterState.tableMode = e.target.value;
          recomputeAndRender();
        }
      });
    });

    const optionInputs = document.querySelectorAll('input[name="table-option"]');
    optionInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        if (e.target.checked) {
          filterState.tableOption = e.target.value;
        } else {
          filterState.tableOption = null;
        }
        recomputeAndRender();
      });
    });
  }

  wireTableControls();
  

  // TODO: postcode chart filter handler

  // optional reset button if present in HTML
  const resetBtn = document.getElementById('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      filterState.postcode = null;
      filterState.breed = null;
      filterState.group = null;
      recomputeAndRender();
    });
  }
});

renderFilterDisplay(filterState);
