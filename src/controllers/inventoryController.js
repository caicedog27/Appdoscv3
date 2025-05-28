const siigoService = require('../services/siigoServicePerlas');
const admin = require('firebase-admin');
const { parseNumber } = require('../utils/numberUtils');


exports.showInventory = (req, res) => {
    res.render('inventarios', { title: 'Inventarios' });
};

exports.showProductInventory = (req, res) => {
    res.render('inventarios', { title: 'Inventario por Producto' });
};

exports.showInventoryCount = (req, res) => {
    res.render('inventarios', { title: 'Conteo de Inventario' });
};

exports.showTotalInventory = async (req, res) => {
    try {
        const pageSize = 25;
        let currentPage = 1;
        let totalProducts = [];
        let totalPages = 1;

        // Recopilar todos los productos usando paginación
        do {
            const response = await siigoService.getProducts(currentPage, pageSize);
            
            if (response && response.results) {
                totalProducts = totalProducts.concat(response.results);
            }

            // Calcular el total de páginas basado en la respuesta de la API
            totalPages = Math.ceil(response.pagination.total_results / pageSize);
            currentPage++;
        } while (currentPage <= totalPages);

        // Mapear los productos para la vista
        const products = totalProducts.map(product => ({
            id: product.id,
            code: product.code,
            name: product.name,
            type: product.type,
            stock_control: product.stock_control ? 'Sí' : 'No',
            available_quantity: product.available_quantity,
            warehouse_names: product.warehouses && product.warehouses.length > 0
                ? product.warehouses.map(w => `${w.name} (Cantidad: ${w.quantity})`).join(', ')
                : 'N/A',
            unit: product.unit ? product.unit.name : 'N/A',
            unit_label: product.unit_label || 'N/A',
            reference: product.reference || 'N/A',
            description: product.description || 'N/A',
            account_group: product.account_group ? product.account_group.name : 'N/A',
            taxes: product.taxes && product.taxes.length > 0
                ? product.taxes.map(tax => `${tax.name} (${tax.percentage}%)`).join(', ')
                : 'Sin impuestos',
            prices: product.prices && product.prices.length > 0
                ? product.prices.map(price => `COP ${price.price_list[0].value}`).join(', ')
                : 'N/A',
            additional_fields: product.additional_fields
                ? `Código de barras: ${product.additional_fields.barcode || 'N/A'}, Marca: ${product.additional_fields.brand || 'N/A'}, Modelo: ${product.additional_fields.model || 'N/A'}` 
                : 'N/A',
            tax_classification: product.tax_classification,
            active: product.active ? 'Sí' : 'No'
        }));

        res.render('inventoryTotal', {
            layout: 'layout',
            title: 'Inventario Total',
            products,
            totalProducts: totalProducts.length
        });

    } catch (error) {
        console.error('Error al cargar Inventario Total:', error.message);
        res.status(500).send('Error al cargar el inventario total');
    }
};


// Mostrar la página de inventario organizado por marcas
exports.showOrganizedInventory = async (req, res) => {
    try {
        // Consultar todos los productos de Siigo
        const products = await siigoService.getAllProducts();

        // Definir marcas, sabores y presentaciones
        const brands = {
            "Liquipops": ["Blueberry", "Fresa", "Manzana Verde", "Lychee", "Cereza", "Mango Biche", "Pink", "Maracuyá", "Chicle", "Sandía", "Coco", "Café"],
            "Sirope Clásico Geniality": ["Blueberry", "Fresa", "Manzana Verde", "Lychee", "Cereza", "Mango Biche", "Maracuyá", "Curacao", "Granadina", "Sandía", "Jarabe"],
            "Sirope Cósmicos": ["Blueberry", "Neonberry", "Manzana Verde", "Frutos Amarillos"],
            "Sirope Clásico Bubols": ["Lychee", "Granadina", "Jarabe"],
            "Yexis": ["Blueberry", "Fresa", "Manzana Verde", "Lychee", "Cereza", "Mango Biche", "Maracuyá", "Coco", "Café", "Naranja"],
            "Skarcha": ["Sal Limón", "Azúcar Blueberry", "Azúcar Chicle", "Azúcar Lima Limón", "Sal Ají", "Sal Maracuyá", "Sal Pimienta", "Azúcar Mango Biche", "Azúcar Sandía", "Azúcar Cereza"]
        };

        // Crear un objeto para almacenar tablas organizadas por marca
        const organizedTables = {};

        // Organizar los productos en tablas según marca y sabor
        for (const [brand, flavors] of Object.entries(brands)) {
            const brandProducts = products.filter(product => product.name.includes(brand));
            const tableRows = {};

            brandProducts.forEach(product => {
                const presentation = product.name.match(/\d+ ?(ml|g|gr|onz)/i)?.[0] || 'N/A';
                const flavor = flavors.find(f => product.name.toLowerCase().includes(f.toLowerCase())) || 'Otro';

                if (!tableRows[presentation]) tableRows[presentation] = {};
                tableRows[presentation][flavor] = product.available_quantity || 0;
            });

            organizedTables[brand] = tableRows;
        }

        // Renderizar la vista con las tablas organizadas
        res.render('inventoryProduct', {
            title: 'Inventario por Producto',
            organizedTables
        });

    } catch (error) {
        console.error('Error al cargar el inventario organizado:', error.message);
        res.status(500).send('Error al cargar el inventario.');
    }
};


exports.showTotalInv = async (req, res) => {
    try {
        const pageSize = 100;
        let currentPage = 1;
        let totalProducts = [];
        let totalPages = 1;

        // Recopilar todos los productos usando paginación
        do {
            const response = await siigoService.getProducts(currentPage, pageSize);

            if (response && response.results) {
                totalProducts = totalProducts.concat(response.results);
            }

            // Calcular el total de páginas basado en la respuesta de la API
            totalPages = Math.ceil(response.pagination.total_results / pageSize);
            currentPage++;
        } while (currentPage <= totalPages);

        console.log('Número total de productos obtenidos:', totalProducts.length);

        // Organizar productos por marcas y sabores
        const organizedTables = organizeProducts(totalProducts);

        // Renderizar la vista con los productos organizados
        res.render('inventoryProduct', {
            layout: 'layout',
            title: 'Inventario Total',
            organizedTables
        });
    } catch (error) {
        console.error('Error al cargar Inventario Total:', error.message);
        res.status(500).send('Error al cargar el inventario total');
    }
};

// Función para organizar los productos por marca y sabor
// Función para organizar los productos por marca y sabor
function organizeProducts(products) {
    const brands = {
        "Liquipops": [
            "Blueberry", "Fresa", "Manzana Verde", "Lychee", "Cereza",
            "Mango Biche", "Pink", "Maracuyá", "Chicle", "Sandía",
            "Coco", "Café"
        ],
        "SIROPE GENIALITY": [
            "Blueberry", "Fresa", "Manzana Verde", "Lychee", "Cereza",
            "Mango Biche", "Maracuyá", "Curacao", "Granadina",
            "Sandía", "Jarabe", "Caramelo", "Vainilla", "Ice Pink"
        ],
        "Yexis": [
            "Blueberry", "Fresa", "Manzana Verde", "Lychee", "Cereza",
            "Mango Biche", "Maracuyá", "Coco", "Café", "Naranja"
        ],
        "Skarcha Azúcar": [
            "Blueberry", "Chicle", "Lima Limón", "Mango Biche",
            "Maracuyá", "Sandía", "Cereza"
        ],
        "Skarcha Sal": [
            "Limón", "Ají", "Maracuyá", "Pimienta"
        ],
        "Coctel": [
            "Aguardiente Maracuyá", "Crema de Whisky", "Ginebra Mango Biche",
            "Mojito", "Ron Cereza", "Tequila Black", "Tequila Sandía",
            "Vodka Manzana Verde", "Vodka Naranja"
        ],
        "Coctel Premium": [
            "Aguardiente Maracuyá", "Cereza", "Crema de Whisky",
            "Ginebra Mango Biche", "Mojito", "Tequila Black",
            "Tequila Sandía", "Vodka Manzana Verde", "Vodka Naranja",
            "Crema de Whisky"
        ],
        "SIROPE BUBOLS": [
            "LYCHE",
             "Granadina",
             "Jarabe",
                   ],
        "SIROPE BUBOLS PREMIUM": [
            "FRUTOS AMARILLOS CÓSMICO",
            "BLUEBERRY CÓSMICO",
            "MANZANA V. CÓSMICO", "NEÓNBERRY CÓSMICO"
        ],
        "BUBOLS PREMIUM": [
            "LIMA LIMÓN CÓSMICO", "FRUTOS AMARILLOS CÓSMICO",
            "LYCHE CÓSMICO", "BLUEBERRY CÓSMICO",
            "MANZANA V. CÓSMICO", "NEÓNBERRY CÓSMICO"
        ],

        // Agrega otras marcas y sabores según sea necesario
    };

    const organizedTables = {};
    const undefinedProducts = []; // Para productos que no se pudieron clasificar

    // Función para normalizar una cadena (quita tildes y pasa a minúsculas)
    const normalizeString = (str) =>
        str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Función para extraer el sabor a partir de la cadena (buscando "sabor a")
    const extractFlavorFromName = (productName) => {
        // Busca "sabor a" seguido de cualquier cosa hasta el próximo "X" o fin de línea
        const regex = /sabor\s+a\s+([^X]+)/i;
        const match = productName.match(regex);
        if (match && match[1]) {
            return match[1].trim();
        }
        return null;
    };

    // Función robusta para encontrar el sabor en base al nombre y a los sabores listados
    const findFlavor = (productName, flavors) => {
        const extracted = extractFlavorFromName(productName);
        if (extracted) {
            const normExtracted = normalizeString(extracted);
            // Primero, intentar coincidencia exacta con los candidatos
            for (const candidate of flavors) {
                if (normalizeString(candidate) === normExtracted) {
                    return candidate;
                }
            }
            // Luego, probar coincidencias parciales
            for (const candidate of flavors) {
                const normCandidate = normalizeString(candidate);
                if (normExtracted.includes(normCandidate) || normCandidate.includes(normExtracted)) {
                    return candidate;
                }
            }
            // Si no coincide, devolver lo extraído capitalizado
            return extracted.charAt(0).toUpperCase() + extracted.slice(1).toLowerCase();
        }
        // Si no se pudo extraer un sabor, revisar si aparece alguna de las palabras clave en el producto
        const normalizedProduct = normalizeString(productName);
        for (const flavor of flavors) {
            if (normalizedProduct.includes(normalizeString(flavor))) {
                return flavor;
            }
        }
        return 'Otro';
    };

    // Función para identificar la marca y el sabor.
    // Ordena las marcas por longitud (de mayor a menor) para evaluar primero las más específicas.
    const findBrandAndFlavor = (productName) => {
        const normalizedProduct = normalizeString(productName);
        const sortedEntries = Object.entries(brands).sort((a, b) => b[0].length - a[0].length);
        for (const [brand, flavors] of sortedEntries) {
            if (normalizedProduct.includes(normalizeString(brand))) {
                const flavor = findFlavor(productName, flavors);
                return { brand, flavor };
            }
        }
        return { brand: 'Otro', flavor: 'Otro' };
    };

    // Función para normalizar la presentación
    const normalizePresentation = (presentation) => {
        if (!presentation || normalizeString(presentation) === 'n/a') return 'N/A';

        let cleaned = presentation.trim();

        // Asegurar que 'X' esté en mayúscula y seguido de un espacio
        cleaned = cleaned.replace(/^x\s*/i, 'X ');

        // Insertar espacio entre número y unidad si falta
        cleaned = cleaned.replace(/(\d+)(ml|g|gr|onz|kg|p|esferas)/i, '$1 $2');

        // Normalizar unidades a minúsculas usando un mapeo
        const unitMap = {
            'gr': 'g',
            'onz': 'oz',
            'ozs': 'oz',
            'grs': 'g',
            'ml': 'ml',
            'kg': 'kg',
            'p': 'p',
            'esferas': 'esferas',
            'un': 'un'
        };

        cleaned = cleaned.replace(/(\d+)\s*(ml|g|gr|onz|kg|p|esferas)/i, (match, p1, p2) => {
            const normalizedUnit = unitMap[p2.toLowerCase()] || p2.toLowerCase();
            return `${p1} ${normalizedUnit}`;
        });

        // Reemplazar múltiples espacios por uno solo
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned;
    };

    // Procesar cada producto
    products.forEach(product => {
        let brand, flavor, presentation;

        // Caso especial: Si el producto es "JARABE PARA ESCARCHAR" (sin información extra)
        if (normalizeString(product.name) === "jarabe para escarchar") {
            brand = "SIROPE BUBOLS";
            flavor = "Jarabe para Escarchar";
            presentation = "X 1200 ml";
        } else {
            // Extraer la presentación (por ejemplo "X 2300 GR")
            const presentationMatch = product.name.match(/(?:X\s*)?\d+\s?(ml|g|gr|onz|kg|p|esferas)/i);
            const rawPresentation = presentationMatch ? presentationMatch[0] : 'N/A';
            presentation = normalizePresentation(rawPresentation);

            const bf = findBrandAndFlavor(product.name);
            brand = bf.brand;
            flavor = bf.flavor;
        }

        if (brand !== 'Otro') {
            if (!organizedTables[brand]) organizedTables[brand] = {};
            if (!organizedTables[brand][presentation]) organizedTables[brand][presentation] = {};
            const quantityNumber = parseNumber(product.available_quantity);
            organizedTables[brand][presentation][flavor] =
                (organizedTables[brand][presentation][flavor] || 0) + (isNaN(quantityNumber) ? 0 : quantityNumber);

            console.log(`Producto: ${product.name}, Marca: ${brand}, Sabor: ${flavor}, Presentación: ${presentation}, Cantidad: ${isNaN(quantityNumber) ? 0 : quantityNumber}`);
        } else {
            undefinedProducts.push(product);
            console.error(`Producto no definido: ${product.name}. Revisa si la marca o el sabor están correctamente escritos.`);
        }
    });

    console.log('Marcas encontradas:', Object.keys(organizedTables));
    console.log('Productos no definidos:', undefinedProducts.map(p => p.name));

    return organizedTables;
}








