import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { connectDatabase } from './src/config/db.js'
import adminRoutes from './src/routes/admin.js'
import authRoutes from './src/routes/auth.js'
import contactRoutes from './src/routes/contact.js'
import portfolioRoutes from './src/routes/portfolio.js'
import { errorHandler, notFound } from './src/middleware/errors.js'

const app = express()
const port = Number(process.env.PORT || 5000)
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random secret of at least 32 characters.')
}

app.disable('x-powered-by')
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || path.join(currentDirectory, 'uploads'))))
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please try again later.' },
}))
app.use('/api/auth', authRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/admin', adminRoutes)
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(currentDirectory, '../client/dist')
  app.use(express.static(dist))
  app.get('*splat', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.use(notFound)
app.use(errorHandler)

connectDatabase()
  .then(() => app.listen(port, () => console.log(`Portfolio server listening on port ${port}`)))
  .catch((error) => {
    console.error('Could not start portfolio server.', error)
    process.exitCode = 1
  })
