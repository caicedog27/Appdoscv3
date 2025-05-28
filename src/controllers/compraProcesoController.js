/************************************************************
 * src/controllers/compraProcesoController.js
 ************************************************************/
const admin = require('../config/firebaseAdmin');
const db = admin.firestore();

const PdfPrinter = require('pdfmake');
const path = require('path');

const fonts = {
  Roboto: {
    normal: path.join(__dirname, '../../fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, '../../fonts/Roboto-Medium.ttf'),
    italics: path.join(__dirname, '../../fonts/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '../../fonts/Roboto-MediumItalic.ttf')
  }
};
const printer = new PdfPrinter(fonts);

const MAIN_STATES = [
  'NEGOCIACION',
  'APROBACION',
  'ORDEN_COMPRA',
  'EN_CAMINO',
  'RECIBIDO'
];

async function listarCompras(req, res) {
  try {
    const snap = await db.collection('ComprasMp')
      .orderBy('createdAt','desc')
      .get();

    const compras = [];
    snap.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;

      // Progreso => cuántos items NO notFound y con negotiatedQuantity > 0
      const items = data.items || [];
      let progress = 0;
      if (items.length) {
        let countValid = 0;
        items.forEach(it => {
          if (!it.notFound && (it.negotiatedQuantity || 0) > 0) {
            countValid++;
          }
        });
        progress = Math.floor((countValid / items.length) * 100);
      }
      data.progress = progress;

      compras.push(data);
    });

    res.render('VistasProcesoCompras/listaDeCompras', {
      title: 'Lista de Compras',
      compras
    });
  } catch (err) {
    console.error('Error listarCompras:', err);
    res.status(500).send('Error al listar compras');
  }
}

async function verDetalleCompra(req, res) {
  try {
    const docId = req.params.docId;
    const docSnap = await db.collection('ComprasMp').doc(docId).get();
    if (!docSnap.exists) {
      return res.status(404).send('Compra no encontrada');
    }
    const compraData = docSnap.data();
    const items = compraData.items || [];

    // Agrupamos por providerId
    const groupedByProvider = {};
    items.forEach(it => {
      const pid = it.providerId || 'SIN-PROVEEDOR';
      if (!groupedByProvider[pid]) groupedByProvider[pid] = [];
      groupedByProvider[pid].push(it);
    });

    // Progreso
    let progress = 0;
    if (items.length) {
      let countOk = 0;
      items.forEach(it => {
        if (!it.notFound && (it.negotiatedQuantity || 0) > 0) {
          countOk++;
        }
      });
      progress = Math.floor((countOk / items.length) * 100);
    }

    const mainState = compraData.mainState || 'NEGOCIACION';
    let viewFile = 'detalleCompraNegociacion';
    switch (mainState) {
      case 'NEGOCIACION': viewFile = 'detalleCompraNegociacion'; break;
      case 'APROBACION':  viewFile = 'detalleCompraAprobacion';  break;
      case 'ORDEN_COMPRA':viewFile = 'detalleCompraOrdenCompra'; break;
      case 'EN_CAMINO':   viewFile = 'detalleCompraEnCamino';    break;
      case 'RECIBIDO':    viewFile = 'detalleCompraRecibido';    break;
    }

    return res.render(`VistasProcesoCompras/estados/${viewFile}`, {
      title: `Proceso de Compra - ${mainState}`,
      compraId: docId,
      compraData,
      groupedByProvider,
      progress
    });
  } catch (err) {
    console.error('Error verDetalleCompra:', err);
    return res.status(500).send('Error al ver detalle de compra');
  }
}

async function cambiarEstadoGeneral(req, res) {
  try {
    const { docId } = req.params;
    const { newMainState } = req.body;
    if (!MAIN_STATES.includes(newMainState)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const ref = db.collection('ComprasMp').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Compra no existe' });
    }

    await ref.update({ mainState: newMainState });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error cambiarEstadoGeneral:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function actualizarItem(req, res) {
  try {
    const { docId } = req.params;
    const {
      code,
      providerId,
      negotiatedQuantity,
      negotiatedPrice,
      notFound,
      notes,
      iva,
      ret,
      unit
    } = req.body;

    const ref = db.collection('ComprasMp').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Compra no existe' });
    }
    const data = snap.data();
    const items = data.items || [];

    // Buscar item
    const idx = items.findIndex(
      it => it.code === code && it.providerId === providerId
    );
    if (idx < 0) {
      return res.status(404).json({ error: 'Ítem no encontrado' });
    }

    // Actualizar
    if (negotiatedQuantity !== undefined) {
      items[idx].negotiatedQuantity = parseFloat(negotiatedQuantity) || 0;
    }
    if (negotiatedPrice !== undefined) {
      items[idx].negotiatedPrice = parseFloat(negotiatedPrice) || 0;
    }
    if (iva !== undefined) {
      items[idx].iva = parseFloat(iva) || 0;
    }
    if (ret !== undefined) {
      items[idx].ret = parseFloat(ret) || 0;
    }
    if (unit !== undefined) {
      items[idx].unit = unit;
    }
    if (notFound !== undefined) {
      items[idx].notFound = Boolean(notFound);
    }
    if (notes !== undefined) {
      items[idx].notes = notes;
    }

    // Marcamos como "guardado" si quieres
    items[idx]._saved = true;

    await ref.update({ items });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error actualizarItem:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function setArrivalData(req, res) {
  try {
    const { docId } = req.params;
    const { estimatedArrivalDate, arrivalNotes } = req.body;

    const ref = db.collection('ComprasMp').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Compra no existe' });
    }

    await ref.update({
      estimatedArrivalDate: estimatedArrivalDate || null,
      arrivalNotes: arrivalNotes || ''
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error setArrivalData:', err);
    return res.status(500).json({ error: err.message });
  }
}

/** NUEVO => setArrivalByProvider => cada proveedor llena arrivalDate, plazo, etc. */
async function setArrivalByProvider(req, res) {
  try {
    const { docId, providerId } = req.params;
    const { arrivalDate, plazo, pago, notes } = req.body;

    const ref = db.collection('ComprasMp').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Compra no existe' });
    }

    let data = snap.data();

    // Creamos un objeto providersData si no existe
    if (!data.providersData) {
      data.providersData = {};
    }
    if (!data.providersData[providerId]) {
      data.providersData[providerId] = {};
    }

    // Guardar la info
    data.providersData[providerId].arrivalDate = arrivalDate || null;
    data.providersData[providerId].plazo       = plazo       || null;
    data.providersData[providerId].pago        = pago        || 'Transferencia';
    data.providersData[providerId].notes       = notes       || '';

    // si hay archivo => req.file
    if (req.file) {
      const originalName = req.file.originalname;
      const fileUrl = '/uploads/' + req.file.filename; // Ajusta a tu gusto
      data.providersData[providerId].soportePago = {
        name: originalName,
        url : fileUrl
      };
    }

    await ref.update(data);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error setArrivalByProvider:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function generarPdfPorProveedor(req, res) {
  try {
    const { docId, providerId } = req.params;
    const ref = db.collection('ComprasMp').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).send('Compra no encontrada');
    }

    const data = snap.data();
    const mainState = data.mainState || 'NEGOCIACION';
    const itemsProv = (data.items || []).filter(it => it.providerId === providerId);
    if (!itemsProv.length) {
      return res.status(404).send('No hay ítems para este proveedor');
    }

    // ...
    // (PDF básico)
    const docDefinition = {
      pageSize: 'A4',
      content: [
        { text: 'Orden de Compra - Proveedor ' + providerId, style: 'header' },
        { text: 'Estado: ' + mainState, style: 'subheader' },
        '\n',
        {
          table: {
            widths: ['auto','auto','auto','auto'],
            body: [
              ['Código','Nombre','Cant.Negociada','Precio'],
              ...itemsProv.map(it => [
                it.code,
                it.name,
                it.negotiatedQuantity || 0,
                (it.negotiatedPrice||0).toLocaleString()
              ])
            ]
          }
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 14 }
      }
    };

    const printerDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    printerDoc.on('data', c => chunks.push(c));
    printerDoc.on('end', () => {
      const pdfBuf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition','attachment;filename="Orden-'+providerId+'.pdf"');
      res.send(pdfBuf);
    });
    printerDoc.end();
  } catch (err) {
    console.error('Error generarPdfPorProveedor:', err);
    res.status(500).send('Error generando PDF');
  }
}

async function adjuntarDocumentos(req, res) {
  try {
    const { docId } = req.params;
    if (!req.file) {
      return res.redirect('/inventarios/popping/procesoCompra/' + docId + '?err=NoFile');
    }

    const ref = db.collection('ComprasMp').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.redirect('/inventarios/popping/procesoCompra/' + docId + '?err=NoCompra');
    }

    const originalName = req.file.originalname;
    const fileUrl = '/uploads/' + req.file.filename;

    await ref.update({
      attachments: admin.firestore.FieldValue.arrayUnion({
        name: originalName,
        url: fileUrl,
        uploadedAt: new Date()
      })
    });

    return res.redirect('/inventarios/popping/procesoCompra/' + docId + '?msg=FileUploaded');
  } catch (err) {
    console.error('Error adjuntarDocumentos:', err);
    res.status(500).send('Error al subir documento');
  }
}

async function generarPdfListaNegociacion(req, res) {
  try {
    const { docId } = req.params;
    const ref = db.collection('ComprasMp').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).send('Compra no encontrada');
    }

    const data = snap.data();
    const items = data.items || [];
    const grouped = {};
    items.forEach(it => {
      const pid = it.providerId || 'SIN-PROVEEDOR';
      if (!grouped[pid]) grouped[pid] = [];
      grouped[pid].push(it);
    });

    // Info de la Empresa
    const empresa = {
      nombre: 'POPPING BOBA INTERNATIONAL S.A.S.',
      nit: '901878434-1',
      direccion: 'CR 35 NO. 48 A 04, Medellín - Antioquia',
      email: 'gerencia@poppingbobainternational.com',
      telefono: '3112158481'
    };

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        {
          text: 'LISTA DE COMPRAS INICIAL - NEGOCIACIÓN',
          style: 'header'
        },
        {
          text: empresa.nombre,
          style: 'subheader'
        },
        {
          text:
            `NIT: ${empresa.nit}\n` +
            `Dirección: ${empresa.direccion}\n` +
            `Email: ${empresa.email}  |  Tel: ${empresa.telefono}`,
          style: 'small'
        },
        { text: '\n', margin: [0, 10, 0, 10] },
        {
          text: `ID de la Compra: ${docId}\nEstado: NEGOCIACION\n\n`,
          style: 'small'
        },
        ...Object.keys(grouped).map((provId) => {
          const provItems = grouped[provId];
          const provName = provItems[0].providerName || provId;

          const seccion = [
            {
              text: `PROVEEDOR: ${provName} (ID: ${provId})`,
              style: 'providerHeader',
              margin: [0, 10, 0, 5]
            },
            {
              table: {
                widths: ['auto','auto','auto','auto','auto'],
                body: [
                  [
                    { text: 'N°', style: 'tableHeader' },
                    { text: 'Código', style: 'tableHeader' },
                    { text: 'Nombre', style: 'tableHeader' },
                    { text: 'Cant.Solicitada', style: 'tableHeader' },
                    { text: 'Unidad', style: 'tableHeader' }
                  ],
                  ...provItems.map((it, idx) => [
                    (idx+1).toString(),
                    it.code || '',
                    it.name || '',
                    (it.requestedQuantity||0).toString(),
                    (it.unit||'')
                  ])
                ]
              },
              layout: {
                fillColor: rowIndex => rowIndex === 0 ? '#D0F5BE' : null
              }
            },
            { text: '\n' }
          ];
          return seccion;
        })
      ],
      styles: {
        header: { fontSize: 16, bold: true, color: '#008000' },
        subheader: { fontSize: 12, bold: true },
        small: { fontSize: 10 },
        providerHeader: { fontSize: 11, bold: true, color: '#008800' },
        tableHeader: { bold: true, fontSize: 10, color: 'white', fillColor: '#009900' }
      }
    };

    const printerDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    printerDoc.on('data', c => chunks.push(c));
    printerDoc.on('end', () => {
      const pdfBuf = Buffer.concat(chunks);
      res.setHeader('Content-Type','application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="ListaComprasInicial.pdf"'
      );
      res.send(pdfBuf);
    });
    printerDoc.end();
  } catch (error) {
    console.error('Error generarPdfListaNegociacion:', error);
    res.status(500).send('Error generando PDF (Negociación)');
  }
}

async function getNextPurchaseOrderNumber() {
  const snap = await db.collection('ComprasMp')
    .where('purchaseOrderNumber','>',0)
    .orderBy('purchaseOrderNumber','desc')
    .limit(1)
    .get();

  let maxNo = 10000;
  if(!snap.empty){
    const firstDoc = snap.docs[0];
    const data = firstDoc.data();
    maxNo = data.purchaseOrderNumber + 1;
  }
  return maxNo;
}

async function generateOrdenCompraPdf(req, res) {
  try {
    const { docId } = req.params;
    const ref = db.collection('ComprasMp').doc(docId);
    const snap = await ref.get();
    if(!snap.exists){
      return res.status(404).send('Compra no existe');
    }

    const compraData = snap.data();
    let orderNo = compraData.purchaseOrderNumber;
    if(!orderNo){
      orderNo = await getNextPurchaseOrderNumber();
      await ref.update({ purchaseOrderNumber: orderNo });
      compraData.purchaseOrderNumber = orderNo;
    }

    const items = compraData.items||[];
    const grouped= {};
    items.forEach(it=>{
      const pid= it.providerId||'SIN-PROVEEDOR';
      if(!grouped[pid]) grouped[pid]=[];
      grouped[pid].push(it);
    });

    let content = [
      { text: 'ORDEN DE COMPRA', style: 'header'},
      { text: 'Número de Orden: '+ orderNo, style:'subheader'},
      '\n'
    ];
    let totalGlobal=0;

    Object.keys(grouped).forEach(pid=>{
      const provItems= grouped[pid];
      const provName= provItems[0]?.providerName|| pid;
      let sumProv=0;

      const body= [
        ['Código','Nombre','Cant(g)','$/g','Subtotal','IVA','Ret','Total']
      ];
      provItems.forEach(it=>{
        const grams= parseFloat(it.negotiatedQuantity)||0;
        const pGr  = parseFloat(it.negotiatedPrice)||0;
        const subT = grams*pGr;
        const ivaP = parseFloat(it.iva)||0;
        const retP = parseFloat(it.ret)||0;
        const ivaVal= subT*(ivaP/100);
        const retVal= subT*(retP/100);
        const finalVal= subT + ivaVal - retVal;
        sumProv+= finalVal;

        body.push([
          it.code,
          it.name,
          grams.toFixed(0),
          pGr.toFixed(4),
          subT.toFixed(2),
          ivaP+'%('+ivaVal.toFixed(2)+')',
          retP+'%('+retVal.toFixed(2)+')',
          finalVal.toFixed(2)
        ]);
      });
      totalGlobal+= sumProv;

      content.push(
        { text:`Proveedor: ${provName} (ID: ${pid})`, style:'providerHeader', margin:[0,10,0,5]},
        {
          table:{
            widths:['auto','auto','auto','auto','auto','auto','auto','auto'],
            body
          }
        },
        { text:`Subtotal Proveedor: $${sumProv.toFixed(2)}`, margin:[0,5,0,10]}
      );
    });

    content.push({
      text:`TOTAL GLOBAL: $${totalGlobal.toFixed(2)}`,
      style:'bigTotal',
      margin:[0,10,0,0]
    });

    const docDefinition = {
      pageSize:'A4',
      content,
      styles:{
        header:{ fontSize:18, bold:true },
        subheader:{ fontSize:12, bold:true },
        providerHeader:{ fontSize:11, bold:true, color:'#008000'},
        bigTotal:{ fontSize:12, bold:true, alignment:'right'}
      }
    };

    const printerDoc= printer.createPdfKitDocument(docDefinition);
    let chunks=[];
    printerDoc.on('data', c=> chunks.push(c));
    printerDoc.on('end', ()=>{
      const pdfBuf= Buffer.concat(chunks);
      res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition',`attachment;filename="OrdenCompra-${orderNo}.pdf"`);
      res.send(pdfBuf);
    });
    printerDoc.end();

  } catch(err){
    console.error('Error generateOrdenCompraPdf:', err);
    res.status(500).send('Error generando Orden de Compra PDF');
  }
}

/** EJEMPLO: en generateOrdenCompraPdfForProvider, podrías leer providersData[providerId].plazo, etc. */
async function generateOrdenCompraPdfForProvider(req, res) {
  try {
    const { docId, providerId } = req.params;
    const docRef = db.collection('ComprasMp').doc(docId);
    const docSnap= await docRef.get();
    if(!docSnap.exists){
      return res.status(404).send('Compra no existe');
    }

    const compraData= docSnap.data();
    let orderNo= compraData.purchaseOrderNumber;
    if(!orderNo){
      orderNo= await getNextPurchaseOrderNumber();
      await docRef.update({ purchaseOrderNumber: orderNo });
      compraData.purchaseOrderNumber= orderNo;
    }

    const allItems= compraData.items||[];
    const itemsProv= allItems.filter(it=> it.providerId===providerId);
    if(!itemsProv.length){
      return res.status(404).send('No hay ítems para ese proveedor');
    }

    // Info de la empresa
    const empresa={
      nombre: 'POPPING BOBA INTERNATIONAL S.A.S.',
      nit: '901878434-1',
      direccion: 'CR 35 NO. 48 A 04, Medellín - Antioquia',
      email: 'gerencia@poppingbobainternational.com',
      telefono: '3112158481'
    };

    // Leer la data adicional (plazo, pago, etc.) => compraData.providersData[providerId]
    const pd = (compraData.providersData && compraData.providersData[providerId]) || {};
    const plazoStr = pd.plazo ? `${pd.plazo} días` : 'N/A';
    const pagoStr  = pd.pago  || 'N/A';
    // si hay soporte de pago => pd.soportePago?.url

    const provName   = itemsProv[0]?.providerName || providerId;
    const dateNow    = new Date();
    const dateStr    = dateNow.toLocaleDateString('es-CO');

    let subTotal=0, ivaTotal=0, retTotal=0, finalTotal=0;
    const bodyTable=[
      [
        { text:'#', style:'tableHeader', alignment:'center'},
        { text:'ARTÍCULO', style:'tableHeader'},
        { text:'CANT (g)', style:'tableHeader', alignment:'right'},
        { text:'$/g', style:'tableHeader', alignment:'right'},
        { text:'PRECIO TOTAL', style:'tableHeader', alignment:'right'}
      ]
    ];

    itemsProv.forEach((it, idx)=>{
      const grams= parseFloat(it.negotiatedQuantity)||0;
      const priceG= parseFloat(it.negotiatedPrice)||0;
      const st= grams*priceG;
      const ivp= parseFloat(it.iva)||0;
      const rtp= parseFloat(it.ret)||0;
      const ivaVal= st*(ivp/100);
      const retVal= st*(rtp/100);
      const total= st + ivaVal - retVal;

      subTotal += st;
      ivaTotal += ivaVal;
      retTotal += retVal;
      finalTotal += total;

      bodyTable.push([
        { text:(idx+1).toString(), alignment:'center'},
        it.name || '',
        { text: grams.toFixed(0), alignment:'right'},
        { text: priceG.toFixed(4), alignment:'right'},
        { text: total.toFixed(2), alignment:'right'}
      ]);
    });

    const docDefinition = {
      pageSize:'A4',
      pageMargins:[40,60,40,60],
      content:[
        {
          columns:[
            {
              stack:[
                { text:'ORDEN DE COMPRA', style:'ocHeader'},
                { text: empresa.nombre, style:'companyName'},
                { text:`NIT: ${empresa.nit}`, style:'small'},
                { text:`Domicilio: ${empresa.direccion}`, style:'small'},
                { text:`Email: ${empresa.email}`, style:'small'},
                { text:`Tel: ${empresa.telefono}`, style:'small'}
              ],
              width:'60%'
            },
            {
              stack:[
                { text:`N° ORDEN: ${orderNo}`, style:'ocNum'},
                { text:`FECHA: ${dateStr}`, style:'ocNum'}
              ],
              alignment:'right',
              width:'40%'
            }
          ]
        },
        { text:'\n'},
        {
          style:'enviaASection',
          table:{
            widths:['auto','*','auto','*'],
            body:[
              [
                { text:'PROVEEDOR', style:'enviaALabel'},
                { text: provName, style:'enviaAValue'},
                { text:'ENTREGA (estim.)', style:'enviaALabel'},
                { text: (pd.arrivalDate || 'A convenir'), style:'enviaAValue'}
              ],
              [
                { text:'DOMICILIO', style:'enviaALabel'},
                { text:'Dirección Proveedor', style:'enviaAValue'},
                { text:'PLAZO', style:'enviaALabel'},
                { text: plazoStr, style:'enviaAValue'}
              ],
              [
                { text:'CIUDAD', style:'enviaALabel'},
                { text:'Ciudad Proveedor', style:'enviaAValue'},
                { text:'PAGO', style:'enviaALabel'},
                { text: pagoStr, style:'enviaAValue'}
              ],
              [
                { text:'CONTACTO', style:'enviaALabel'},
                { text:'Contacto Proveedor', style:'enviaAValue'},
                { text:'', colSpan:2, border:[false,false,false,false], text:''}
              ],
              [
                { text:'TELÉFONO', style:'enviaALabel'},
                { text:'Tel Proveedor', style:'enviaAValue'},
                { text:'', colSpan:2, border:[false,false,false,false], text:''}
              ]
            ]
          },
          layout:'noBorders'
        },
        { text:'\n'},
        {
          table:{
            widths:['auto','*','auto','auto','auto'],
            body: bodyTable
          },
          layout:{
            fillColor: rowIndex=> rowIndex===0? '#1976D2': null
          }
        },
        {
          style:'summaryTable',
          table:{
            widths:['*','auto'],
            body:[
              [{ text:'SUB-TOTAL', alignment:'right'}, 
               { text:`$ ${subTotal.toFixed(2)}`, alignment:'right'}],
              [{ text:`IVA`, alignment:'right'}, 
               { text:`$ ${ivaTotal.toFixed(2)}`, alignment:'right'}],
              [{ text:`RET`, alignment:'right'}, 
               { text:`- $ ${retTotal.toFixed(2)}`, alignment:'right'}],
              [{ text:'TOTAL', bold:true, alignment:'right'}, 
               { text:`$ ${finalTotal.toFixed(2)}`, bold:true, alignment:'right'}]
            ]
          },
          layout:'noBorders'
        },
        { text:'\n\n'},
        {
          columns:[
            { text:'Firma del vendedor', alignment:'center'},
            { text:'Firma del comprador', alignment:'center'}
          ]
        }
      ],
      styles:{
        ocHeader:{ fontSize:16, bold:true, color:'#0D47A1'},
        companyName:{ fontSize:12, bold:true, color:'#1976D2'},
        ocNum:{ fontSize:10, bold:true, color:'#1976D2'},
        small:{ fontSize:9 },
        enviaASection:{ margin:[0,5,0,5]},
        enviaALabel:{ bold:true, color:'#0D47A1', fontSize:9},
        enviaAValue:{ fontSize:9 },
        tableHeader:{ bold:true, color:'white', fontSize:10},
        summaryTable:{ margin:[0,10,0,0]}
      }
    };

    const pdfDoc= printer.createPdfKitDocument(docDefinition);
    let chunks=[];
    pdfDoc.on('data', c=> chunks.push(c));
    pdfDoc.on('end', ()=>{
      const pdfBuf= Buffer.concat(chunks);
      res.setHeader('Content-Type','application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="OrdenCompra-${providerId}-${orderNo}.pdf"`
      );
      res.send(pdfBuf);
    });
    pdfDoc.end();

  } catch(err){
    console.error('Error generateOrdenCompraPdfForProvider:', err);
    return res.status(500).send('Error generando Orden de Compra PDF por proveedor');
  }
}

module.exports = {
  listarCompras,
  verDetalleCompra,
  cambiarEstadoGeneral,
  actualizarItem,
  setArrivalData,

  // NUEVO => Llenar datos de llegada/pago para un provider
  setArrivalByProvider,

  generarPdfPorProveedor,
  adjuntarDocumentos,
  generarPdfListaNegociacion,
  generateOrdenCompraPdf,
  generateOrdenCompraPdfForProvider
};
