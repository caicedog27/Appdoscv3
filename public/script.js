const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-btn');
const submenuToggles = document.querySelectorAll('.submenu-toggle');

toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

/* Manejar el despliegue del submenú */
submenuToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
        e.preventDefault(); // Evita que recargue la página
        const parent = toggle.parentElement;
        parent.classList.toggle('open'); // Alternar la clase "open"
    });
});
