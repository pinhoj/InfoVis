// main.js
// Loads CSV, keeps global filter state, recomputes aggregates,
// and updates ALL charts when the group filter changes.

import { createBreedChart } from './idioms/breedChart.js';
import { createGroupChart } from './idioms/groupChart.js';
import { createChoropleth } from './idioms/choropleth.js';

// ---- config ----
const margin = { top: 10, right: 10, bottom: 10, left: 140 };
const width  = window.innerWidth * 0.4 - margin.left - margin.right;
let height = window.innerHeight * 0.4 - margin.top - margin.bottom;

// ---- state ----
let rows = [], geodata= {};
let filterState = {
  postcode: null,
  breed: null,
  group: null
};

// ---- data helpers ----
function getFilteredRows() {
  return rows.filter(r =>
    (!filterState.postcode   || r.district_code === filterState.postcode) &&
    (!filterState.breed      || r.dog_breed === filterState.breed) &&
    (!filterState.group || r.dog_breed_group === filterState.group)
  );
}
function getGeoFilteredRows() {
  const dataByDistrict = d3.group(getFilteredRows(), d => d.district_code);

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
  const breedToGroup = new Map(srcRows.map(d => [d.dog_breed, d.dog_breed_group]));
  const arr = Array.from(byBreed, ([dog_breed, dog_count]) => ({
    dog_breed,
    dog_breed_group: breedToGroup.get(dog_breed),
    dog_count
  })).sort((a, b) => d3.descending(a.dog_count, b.dog_count));
  return arr;
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
let breedChart, groupChart, choropleth;

// ---- controller ----
function recomputeAndRender() {
  const filtered = getFilteredRows();
  const breedsAll = rollupBreeds(filtered);
  const topBreeds = breedsAll.slice(0, 10);

  const groups = rollupGroups(filtered).slice(0, 6);

  breedChart.update(topBreeds, {
    selectedGroup: filterState.group,
    selectedBreed: filterState.breed
  });
  groupChart.update(groups, {
    selectedGroup: filterState.group
  });
  choropleth.update({type:"FeatureCollection",features:getGeoFilteredRows()}, filterState)

  // TODO: add chart1 update for postcode filter
}

// ---- boot ----
d3.csv('data/dogs_in_vienna.csv', d => ({
  district_code: +d.district_code,
  dog_breed: d.dog_breed,
  dog_breed_group: d.dog_breed_group,
  dog_count: +d.dog_count,
  dog_density: +d.dog_density,
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
        {width, height, margin:{top:10,bottom:0, left:0, right:0}}
      );
  })

  breedChart = createBreedChart('#chart2', topBreeds, { width, height, margin });
  height = (window.innerHeight * 0.25) - margin.top - margin.bottom;
  groupChart = createGroupChart('#chart3', groups,    { width, height, margin });
  // TODO: create postcode chart for #chart1


  breedChart.on('filter', ({ dog_breed }) => {
    console.log('breed filter event', dog_breed);
    filterState.breed = dog_breed || null;
    recomputeAndRender();
  });


  groupChart.on('filter', ({ dog_breed_group }) => {
    filterState.group = dog_breed_group || null;
    recomputeAndRender();
  });
 

  breedChart.on("hover", ({ dog_breed_group }) => {
    groupChart.hoverGroup(dog_breed_group);
  });


  groupChart.on("hover", ({ dog_breed_group }) => {
    breedChart.hoverByGroup(dog_breed_group);
  });

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
