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
let currentGroupFilter = null;
let selectedBreed = null; // optional: if you keep breed clicks

// ---- data helpers ----
function rollupBreeds(srcRows) {
  const byBreed = d3.rollup(
    srcRows,
    v => d3.sum(v, d => d.dog_count),
    d => d.dog_breed
  );
  // map breed → group (first match)
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
  const filtered = currentGroupFilter
    ? rows.filter(r => r.dog_breed_group === currentGroupFilter)
    : rows;

  const breedsAll = rollupBreeds(filtered);
  const topBreeds = breedsAll.slice(0, 10);

  const groups = rollupGroups(filtered);

  // push state to charts
  breedChart.update(topBreeds, {
    selectedGroup: currentGroupFilter,
    selectedBreed: selectedBreed
  });
  groupChart.update(groups, {
    selectedGroup: currentGroupFilter
  });
}

// ---- boot ----
d3.csv('data/dogs_in_vienna.csv', d => ({
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

  // OPTIONAL: keep breed highlight state if you still use breed clicks
  breedChart.on('click', ({ dog_breed }) => {
    selectedBreed = dog_breed;
    // if a group filter is active and the clicked breed doesn't belong to it,
    // you could clear selectedBreed or ignore; here we keep it as a visual hint.
  });

  // Group chart drives GLOBAL filter across ALL charts
  groupChart.on('filter', ({ dog_breed_group }) => {
    currentGroupFilter = dog_breed_group || null; // toggled off → null
    // when applying a new group filter, it's usually clearer to drop breed selection
    if (currentGroupFilter) selectedBreed = null;
    recomputeAndRender();
  });

  // optional reset button if present in HTML
  const resetBtn = document.getElementById('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentGroupFilter = null;
      selectedBreed = null;
      recomputeAndRender();
    });
  }
});
