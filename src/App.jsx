import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const TIPOS = {
  rapida: { label: 'Rápida' },
  fecha: { label: 'Con fecha' },
  recurrente: { label: 'Recurrente' },
  mantenimiento: { label: 'Mantenimiento' },
  idea: { label: 'Idea' },
}

const FILTROS = [
  ['todas', 'Todas'],
  ['vencida', 'Vencidas'],
  ['hoy', 'Hoy'],
  ['proxima', 'Próximas'],
  ['completada', 'Hechas'],
]

function getSemaforo(item) {
  if (item.estado === 'completado') return 'completada'
  if (item.tipo === 'idea') return 'proxima'

  const fecha = item.tipo === 'mantenimiento' ? item.proxima_fecha : item.fecha_limite
  if (!fecha) return 'hoy' // tarea rápida sin fecha: se trata como algo a hacer ya

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const d = new Date(fecha + 'T00:00:00')
  const diffDias = Math.round((d - hoy) / 86400000)

  if (diffDias < 0) return 'vencida'
  if (diffDias === 0) return 'hoy'
  return 'proxima'
}

function notaFor(item, semaforo) {
  if (item.estado === 'completado') return 'Completada'
  if (item.tipo === 'mantenimiento' && item.intervalo_valor) {
    return `Cada ${item.intervalo_valor} ${item.intervalo_unidad}`
  }
  if (semaforo === 'vencida') return 'Vencida'
  if (item.fecha_limite) return item.fecha_limite
  return item.tipo === 'idea' ? 'Algún día' : 'Sin fecha'
}

export default function App() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [nuevoTexto, setNuevoTexto] = useState('')

  async function cargarPendientes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pendientes')
      .select('*')
      .neq('estado', 'archivado')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    cargarPendientes()
  }, [])

  async function agregarDesdeInbox() {
    const titulo = nuevoTexto.trim()
    if (!titulo) return

    const { error } = await supabase.from('pendientes').insert({
      titulo,
      tipo: 'rapida',
      prioridad: 'media',
      estado: 'pendiente',
    })

    if (error) {
      setError(error.message)
      return
    }
    setNuevoTexto('')
    cargarPendientes()
  }

  async function alternarCompletado(item) {
    const nuevoEstado = item.estado === 'completado' ? 'pendiente' : 'completado'
    const { error } = await supabase
      .from('pendientes')
      .update({
        estado: nuevoEstado,
        fecha_completado: nuevoEstado === 'completado' ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    if (error) {
      setError(error.message)
      return
    }
    cargarPendientes()
  }

  const itemsConSemaforo = items.map((i) => ({ ...i, semaforo: getSemaforo(i) }))

  const contadores = {
    vencidas: itemsConSemaforo.filter((i) => i.semaforo === 'vencida' && i.estado !== 'completado').length,
    hoy: itemsConSemaforo.filter((i) => i.semaforo === 'hoy' && i.estado !== 'completado').length,
    hechas: itemsConSemaforo.filter((i) => i.estado === 'completado').length,
  }

  const visibles = itemsConSemaforo.filter((i) => {
    if (filtro === 'todas') return true
    if (filtro === 'completada') return i.estado === 'completado'
    return i.semaforo === filtro && i.estado !== 'completado'
  })

  return (
    <div className="page">
      <h1>Hoy</h1>

      <div className="inbox">
        <input
          type="text"
          placeholder="Anota algo rápido..."
          value={nuevoTexto}
          onChange={(e) => setNuevoTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregarDesdeInbox()}
        />
        <button onClick={agregarDesdeInbox} aria-label="Agregar">+</button>
      </div>

      <div className="resumen">
        <div className="tarjeta-resumen">
          <div className="numero rojo">{contadores.vencidas}</div>
          <div className="etiqueta">Vencidas</div>
        </div>
        <div className="tarjeta-resumen">
          <div className="numero naranja">{contadores.hoy}</div>
          <div className="etiqueta">Para hoy</div>
        </div>
        <div className="tarjeta-resumen">
          <div className="numero verde">{contadores.hechas}</div>
          <div className="etiqueta">Hechas</div>
        </div>
      </div>

      <div className="filtros">
        {FILTROS.map(([key, label]) => (
          <button
            key={key}
            className={filtro === key ? 'filtro activo' : 'filtro'}
            onClick={() => setFiltro(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="error">Error: {error}</p>}
      {loading && <p className="vacio">Cargando...</p>}

      {!loading && visibles.length === 0 && <p className="vacio">Nada por aquí.</p>}

      <div className="lista">
        {visibles.map((item) => {
          const hecho = item.estado === 'completado'
          return (
            <div className="tarjeta" key={item.id}>
              <button
                className={hecho ? 'check hecho' : 'check'}
                onClick={() => alternarCompletado(item)}
                aria-label="Completar"
              >
                {hecho ? '✓' : ''}
              </button>
              <div className="contenido">
                <p className={hecho ? 'titulo hecho' : 'titulo'}>{item.titulo}</p>
                <div className="meta">
                  <span className="tipo">{TIPOS[item.tipo]?.label ?? item.tipo}</span>
                  <span className={`nota nota-${item.semaforo}`}>{notaFor(item, item.semaforo)}</span>
                </div>
              </div>
              <span className={`prioridad prioridad-${item.prioridad}`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
