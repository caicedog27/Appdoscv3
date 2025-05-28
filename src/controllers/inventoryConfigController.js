exports.showInventoryConfig = async (req, res) => {
    // Lógica para mostrar la configuración del inventario
    res.render('inventoryConfig', { title: 'Configuración de Inventario', defaultTables: [] });
};

exports.saveInventoryConfig = async (req, res) => {
    // Lógica para guardar la configuración en Firebase
    res.status(200).send({ message: 'Configuración guardada exitosamente' });
};

exports.getOptionsFromFirebase = async (req, res) => {
    // Lógica para obtener opciones desde Firebase
    res.status(200).send({ options: [] });
};
