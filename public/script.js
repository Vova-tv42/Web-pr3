const formEl = document.getElementById('form');
const formMessagesEl = document.getElementById('form-messages');
const searchInput = document.getElementById('search');
const filterTypeSelect = document.getElementById('filterType');
const tableBodyEl = document.getElementById('table-body');
const listMessagesEl = document.getElementById('list-messages');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const paginationEl = document.getElementById('pagination');

let currentPage = 1;
let totalPages = 1;
let currentSearch = '';
let currentType = 'all';

const dateFormatter = Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function setMessage(element, text = '', type = '') {
  element.textContent = text || '';
  element.classList.remove('success', 'error');

  if (type === 'success') element.classList.add('success');
  if (type === 'error') element.classList.add('error');
}

function isRepairOverdue(date) {
  if (!date) return false;

  const repairDate = new Date(date);
  const tenYearsAgoDate = new Date();
  tenYearsAgoDate.setFullYear(tenYearsAgoDate.getFullYear() - 10);

  return repairDate < tenYearsAgoDate;
}

const updatePage = (page) => {
  currentPage = page;
  return fetchSubstations();
};

function renderRows(items) {
  tableBodyEl.innerHTML = '';

  if (!items || items.length === 0) {
    const tr = document.createElement('tr');
    tr.classList.add('substation-table__row');

    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'muted';
    td.textContent = 'Немає записів.';

    tr.appendChild(td);
    tableBodyEl.appendChild(tr);

    return;
  }

  items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.classList.add('substation-table__row');

    const isOverdue = isRepairOverdue(item.last_repair_date);
    if (isOverdue) tr.classList.add('danger');

    const statusHtml = isOverdue ? '<span class="substation-table__badge danger">Потребує ремонту</span>' : 'Норма';

    tr.innerHTML = `
      <td>${item.address}</td>
      <td>${item.type}</td>
      <td>${item.apartments_count}</td>
      <td>${Number(item.power).toFixed(1)}</td>
      <td>${dateFormatter.format(new Date(item.last_repair_date))}</td>
      <td>${item.estimated_load}</td>
      <td>${statusHtml}</td>
    `;

    tableBodyEl.appendChild(tr);
  });
}

function updatePaginationControls() {
  paginationEl.textContent = `${currentPage} з ${totalPages}`;
  prevPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= totalPages;
}

async function fetchSubstations() {
  setMessage(listMessagesEl, 'Завантаження...');

  const searchParams = new URLSearchParams({
    page: currentPage,
    search: currentSearch,
    type: currentType,
  });

  const displayError = (message) => {
    totalPages = 1;
    renderRows(null);
    updatePaginationControls();
    setMessage(listMessagesEl, message, 'error');
  };

  try {
    const response = await fetch(`/api/substations?${searchParams.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      displayError(data.message || 'Не вдалося отримати дані.');
      return;
    }

    totalPages = data.totalPages || 1;
    renderRows(data.items);
    updatePaginationControls();
    setMessage(listMessagesEl, data.total === 0 ? 'Записів не знайдено.' : '');
  } catch (error) {
    displayError('Трапилась помилка. Перевірте підключення до сервера.');
  }
}

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(formMessagesEl);

  const formData = new FormData(formEl);
  const payload = {
    address: formData.get('address')?.trim() ?? '',
    type: formData.get('type')?.trim() ?? '',
    apartments_count: Number(formData.get('apartments_count')) ?? 0,
    power: Number(formData.get('power')) ?? 0,
    last_repair_date: formData.get('last_repair_date')?.trim() ?? '',
  };

  try {
    const response = await fetch('/api/substations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(formMessagesEl, data.message || 'Не вдалося зберегти дані.', 'error');
      return;
    }

    setMessage(formMessagesEl, 'Підстанцію успішно зареєстровано.', 'success');
    formEl.reset();

    await updatePage(1);
  } catch (error) {
    setMessage(formMessagesEl, 'Трапилась помилка. Спробуйте ще раз.', 'error');
  }
});

let searchDebounceTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);

  searchDebounceTimer = setTimeout(() => {
    currentSearch = searchInput.value?.trim() ?? '';
    updatePage(1);
  }, 500);
});

filterTypeSelect.addEventListener('change', () => {
  currentType = String(filterTypeSelect.value || 'all');
  updatePage(1);
});

prevPageButton.addEventListener('click', () => {
  if (currentPage <= 1) return;
  updatePage(currentPage - 1);
});

nextPageButton.addEventListener('click', () => {
  if (currentPage >= totalPages) return;
  updatePage(currentPage + 1);
});

fetchSubstations();
