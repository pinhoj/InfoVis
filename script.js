// main.js
// Loads CSV, keeps global filter state, recomputes aggregates,
// and updates ALL charts when the group filter changes.

import { createBreedChart } from './components/BreedChart.js';
import { createGroupChart } from './components/groupChart.js';

// ---- config ----
const margin = { top: 20, right: 20, bottom: 20, left: 20 };
const width  = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// ---- state ----
let rows = [];
let filterState = {
  postcode: null,
  breed: null,
  breedGroup: null
};

// ---- data helpers ----
function getFilteredRows() {
  return rows.filter(r =>
    (!filterState.postcode   || r.district_code === filterState.postcode) &&
    (!filterState.breed      || r.dog_breed === filterState.breed) &&
    (!filterState.breedGroup || r.dog_breed_group === filterState.breedGroup)
  );
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
let breedChart, groupChart;

// ---- controller ----
function recomputeAndRender() {
  const filtered = getFilteredRows();
  const breedsAll = rollupBreeds(filtered);
  const topBreeds = breedsAll.slice(0, 10);
  const groups = rollupGroups(filtered);

  breedChart.update(topBreeds, {
    selectedGroup: filterState.breedGroup,
    selectedBreed: filterState.breed
  });
  groupChart.update(groups, {
    selectedGroup: filterState.breedGroup
  });
  // TODO: add chart1 update for postcode filter
}

// ---- boot ----
d3.csv('data/dogs_in_vienna.csv', d => ({
  district_code: d.district_code,
  dog_breed: d.dog_breed,
  dog_breed_group: d.dog_breed_group,
  dog_count: +d.dog_count
})).then(data => {
  rows = data;

  // initial aggregates
  const breedsAll = rollupBreeds(rows);
  const topBreeds = breedsAll.slice(0, 10);
  const groups    = rollupGroups(rows);

  // create charts
  breedChart = createBreedChart('#chart2', topBreeds, { width, height, margin });
  groupChart = createGroupChart('#chart3', groups,    { width, height, margin });
  // TODO: create postcode chart for #chart1

  // Breed chart filter
  breedChart.on('filter', ({ dog_breed }) => {
    console.log('breed filter event', dog_breed);
    filterState.breed = dog_breed || null;
    recomputeAndRender();
  });

  // Group chart filter
  groupChart.on('filter', ({ dog_breed_group }) => {
    filterState.breedGroup = dog_breed_group || null;
    recomputeAndRender();
  });

  // TODO: postcode chart filter handler

  // optional reset button if present in HTML
  const resetBtn = document.getElementById('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      filterState.postcode = null;
      filterState.breed = null;
      filterState.breedGroup = null;
      recomputeAndRender();
    });
  }
});
