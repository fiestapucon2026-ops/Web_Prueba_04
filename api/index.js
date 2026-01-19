const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importaciones del SDK v2 de Mercado Pago (sin legacy code)
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Validación de variables de entorno
if (!process.env.MP_ACCESS_TOKEN) {
  console.error('ERROR: MP_ACCESS_TOKEN no está configurado en las variables de entorno');
}

// Inicialización del cliente de Mercado Pago (SDK v2)
let client;
let preferenceClient;

try {
  client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || '',
    options: {
      timeout: 5000,
      idempotencyKey: 'abc'
    }
  });
  
  preferenceClient = new Preference(client);
} catch (error) {
  console.error('Error al inicializar Mercado Pago:', error.message);
}

/**
 * Ruta POST /api/create_preference
 * Crea una preferencia de pago en Mercado Pago
 */
app.post('/api/create_preference', async (req, res) => {
  try {
    // Validación de token de acceso
    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(500).json({
        error: 'MP_ACCESS_TOKEN no configurado',
        message: 'El token de acceso de Mercado Pago no está configurado en las variables de entorno'
      });
    }

    // Extracción y validación de datos del body
    const { title, price, quantity } = req.body;

    // Validación de campos requeridos
    if (!title || title.trim() === '') {
      return res.status(400).json({
        error: 'Campo requerido faltante',
        message: 'El campo "title" es obligatorio'
      });
    }

    if (price === undefined || price === null) {
      return res.status(400).json({
        error: 'Campo requerido faltante',
        message: 'El campo "price" es obligatorio'
      });
    }

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({
        error: 'Campo requerido faltante',
        message: 'El campo "quantity" es obligatorio'
      });
    }

    // CONVERSIÓN FORZADA A NÚMERO (crítico para evitar errores de tipo)
    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);

    // Validación de tipos numéricos
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        error: 'Tipo de dato inválido',
        message: 'El campo "price" debe ser un número mayor a 0'
      });
    }

    if (isNaN(numericQuantity) || numericQuantity <= 0 || !Number.isInteger(numericQuantity)) {
      return res.status(400).json({
        error: 'Tipo de dato inválido',
        message: 'El campo "quantity" debe ser un número entero mayor a 0'
      });
    }

    // Construcción del objeto de preferencia (SDK v2)
    const preferenceData = {
      items: [
        {
          title: title.trim(),
          quantity: numericQuantity,
          unit_price: numericPrice,
          currency_id: 'ARS' // Puedes cambiar según tu país
        }
      ],
      back_urls: {
        success: `${req.headers.origin || 'http://localhost:3000'}/success`,
        failure: `${req.headers.origin || 'http://localhost:3000'}/failure`,
        pending: `${req.headers.origin || 'http://localhost:3000'}/pending`
      },
      auto_return: 'approved',
      notification_url: process.env.MP_NOTIFICATION_URL || undefined
    };

    // Creación de la preferencia usando el SDK v2
    const preference = await preferenceClient.create({ body: preferenceData });

    // Validación de respuesta
    if (!preference || !preference.id) {
      return res.status(500).json({
        error: 'Error al crear preferencia',
        message: 'Mercado Pago no devolvió un ID de preferencia válido'
      });
    }

    // Respuesta exitosa
    return res.status(200).json({
      id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point
    });

  } catch (error) {
    // Manejo de errores: SIEMPRE responder con JSON
    console.error('Error en /api/create_preference:', error);

    // Extracción de mensaje de error
    let errorMessage = 'Error desconocido al crear la preferencia';
    let errorDetails = null;

    if (error.response && error.response.data) {
      errorMessage = error.response.data.message || errorMessage;
      errorDetails = error.response.data;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Respuesta de error en formato JSON
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    });
  }
});

/**
 * Ruta GET /api/health
 * Endpoint de salud para verificar que el servidor está funcionando
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mp_configured: !!process.env.MP_ACCESS_TOKEN
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.method} ${req.path} no existe`
  });
});

// Exportación para Vercel Serverless Functions
// NO usar app.listen() en producción
module.exports = app;

// Solo para desarrollo local (opcional)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`MP_ACCESS_TOKEN configurado: ${!!process.env.MP_ACCESS_TOKEN}`);
  });
}
