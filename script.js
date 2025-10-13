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
    ["Table Mode", filterState.tableMode || 'All'],
    ["Table Option", filterState.tableOption || 'None'],
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

// ---- charts (created after data load) ----
let breedChart, groupChart, choropleth, tileChart;

// ---- controller ----
function recomputeAndRender() {
  const breedFiltered = getBreedFilteredRows();
  const groupFiltered = getGroupFilteredRows();
  const breedsAll = rollupBreeds(breedFiltered);
  const topBreeds = breedsAll.slice(0, 10);

  const groups = rollupGroups(groupFiltered).slice(0, 6);

  breedChart.update(topBreeds, filterState);
  groupChart.update(groups, filterState);
  choropleth.update({type:"FeatureCollection", features:getGeoFilteredRows()}, filterState)
  tileChart.update(rows, filterState);

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
})).then(data => {
  rows = data.filter(d => d.dog_breed !== "Unknown");

  // initial aggregates
  const breedsAll = rollupBreeds(rows);
  const topBreeds = breedsAll.slice(0, 10);
  const groups    = rollupGroups(rows).slice(0, 6);

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
    };
    recomputeAndRender();
  });


  groupChart.on('filter', ({ dog_breed_group }) => {
    filterState = {
      postcode: filterState.postcode,
      breed: null,
      group: dog_breed_group || null,
    };
    recomputeAndRender();
  });

  breedChart.on("hover", ({ dog_breed_group }) => {
    groupChart.hoverGroup(dog_breed_group);
  });


  groupChart.on("hover", ({ dog_breed_group }) => {
    breedChart.hoverByGroup(dog_breed_group);
  });

  tileChart = createTileChart('#chart4', rows, { 
    xField: filterState.tableMode,
    yField: filterState.tableOption,         // binned on X
    bins: 6, width, height });
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
