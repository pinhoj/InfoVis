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
let dogsWithInfo = [];
let filterState = {
  postcode: null,
  breed: null,
  group: null,
  // table controls from #chart4
  // tableMode: 'population_density',
  // tableOption: 'adaptability',
};
let heatMapState = {
  x:'population_density',
  y:'dog_size',
}


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
function getDogsWithInfo() {
  dogsWithInfo = rows.filter(r => (r.dog_breed_group != "") &&
  (!filterState.postcode    || r.district_code === filterState.postcode) && 
  (!filterState.group    || r.dog_breed_group === filterState.group) && 
  (!filterState.breed    || r.dog_breed === filterState.breed)
);
console.log(dogsWithInfo);
  
}

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

function computeBins(data, state) {
  let xBinner;
  if (state.x == "avg_age"){
    xBinner = d3.bin()
      .domain([41,50])
      .thresholds(d3.range(41,50,1.5));
  }
  else {
    xBinner = d3.bin()
      .domain([0,30000])
      .thresholds(d3.range(0,30000,5000));
  }

  let yBins;
  //size is categorical
  let sizes = ["Very Small", "Small", "Medium", "Large", "Very Large"];
  if (state.y == "dog_size"){
    yBins = sizes.map(d => ({
      label: d,
      test: v => v === d
    }));
  }
  else { //other possible y are numerical 
    const yBinner = d3.bin()
        .domain([0,5])
        .thresholds(d3.range(0, 5, 1));

    yBins = yBinner(data.map(d => d[state.y])).map(bin => ({
      label: `${bin.x0}-${bin.x1}`,
      test: (val) => val > bin.x0 && val <= bin.x1
    }));
  }
  // console.log("Y BINS: ", yBins)

  const bins = xBinner(data.map(d => d[state.x]));
  // console.log("X BINS: ", bins)

  const result = [];
  bins.forEach((_, i) => {
    const xStart = bins[i].x0;
    const xEnd = bins[i].x1;

    yBins.forEach(yVal => {
      const binPoints = data.filter(d =>
        d[state.x] > xStart && d[state.x] <= xEnd &&
        yVal.test(d[state.y])
      );
      // console.log("BINPOINTS",binPoints);

      const totalCount = d3.sum(binPoints, d => d.dog_count);
      
       result.push({
        xBinLabel: `${xStart}-${xEnd}`,
        yBinLabel: yVal.label,
        totalCount
      });
    });
  });

  return result;
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
  
  getDogsWithInfo();
  const bins = computeBins(dogsWithInfo, heatMapState);
  tileChart.update(bins, heatMapState, filterState);

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
  dog_size: d.dog_size,
  adaptability: +d.adaptability,
  friendliness: +d.friendliness,
  health_needs: +d.health_needs,
  trainability: +d.trainability,
  exercise_needs: +d.exercise_needs,
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

  getDogsWithInfo();
  const bins = computeBins(dogsWithInfo, heatMapState);

  // console.log(bins);
  // console.log(computeBins(dogsWithInfo,{x:"avg_age", y:"adaptability"}))

  tileChart = createTileChart('#chart4', bins, heatMapState, filterState,
            {width, height, margin:{top:20,bottom:5, left:0, right:0}});

  tileChart.on("changeState", ({ newState }) => {
    console.log(newState);
    heatMapState = newState;
    recomputeAndRender()
  });
  
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
