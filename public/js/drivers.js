document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('drivers-body');

  try {
    const response = await fetch('/api/drivers');

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const result = await response.json();

    // если вдруг API вернёт объект — страхуемся
    const drivers = Array.isArray(result) ? result : [];

    tbody.innerHTML = '';

    drivers.forEach((driver, index) => {
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${index + 1}</td>

        <td class="driver-cell">
          <div class="driver-info">
            <img src="${driver.image_url || '/img/default-driver.png'}"
               class="driver-avatar"
               alt="${driver.name}">
            <span>${driver.name}</span>
          </div>
        </td>

        <td>${driver.team}</td>
        <td class="points">${driver.points ?? 0}</td>
        <td>${driver.wins ?? 0}</td>
        <td>${driver.podiums ?? 0}</td>
        <td>${driver.starts ?? '-'}</td>
      `;

      tbody.appendChild(row);
    });

  } catch (err) {
    console.error('Failed to load drivers:', err);

    // ❗ не очищаем таблицу полностью — показываем сообщение
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; color:red;">
          Drivers data is unavailable
        </td>
      </tr>
    `;
  }
});
