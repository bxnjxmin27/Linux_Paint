export type ToolId =
  | 'select-rect'
  | 'select-free'
  | 'pencil'
  | 'fill'
  | 'text'
  | 'eraser'
  | 'picker'
  | 'magnifier'
  | 'brush'
  | 'shape'

export type BrushType =
  | 'brush'
  | 'calligraphy1'
  | 'calligraphy2'
  | 'airbrush'
  | 'oil'
  | 'crayon'
  | 'marker'
  | 'pencil'
  | 'watercolor'

export type ShapeType =
  | 'line'
  | 'curve'
  | 'ellipse'
  | 'rect'
  | 'rounded-rect'
  | 'polygon'
  | 'triangle'
  | 'right-triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'arrow-right'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-down'
  | 'star-4'
  | 'star-5'
  | 'star-6'
  | 'callout-rect'
  | 'callout-oval'
  | 'callout-cloud'
  | 'heart'
  | 'lightning'

export interface BrushMeta {
  id: BrushType
  de: string
  en: string
}

export const BRUSHES: BrushMeta[] = [
  { id: 'brush', de: 'Pinsel', en: 'Brush' },
  { id: 'calligraphy1', de: 'Kalligrafiepinsel 1', en: 'Calligraphy brush 1' },
  { id: 'calligraphy2', de: 'Kalligrafiepinsel 2', en: 'Calligraphy brush 2' },
  { id: 'airbrush', de: 'Sprühpinsel', en: 'Airbrush' },
  { id: 'oil', de: 'Ölpinsel', en: 'Oil brush' },
  { id: 'crayon', de: 'Wachsmalstift', en: 'Crayon' },
  { id: 'marker', de: 'Marker', en: 'Marker' },
  { id: 'pencil', de: 'Naturbleistift', en: 'Natural pencil' },
  { id: 'watercolor', de: 'Aquarellpinsel', en: 'Watercolor brush' }
]

export interface ShapeMeta {
  id: ShapeType
  de: string
  en: string
}

export const SHAPES: ShapeMeta[] = [
  { id: 'line', de: 'Linie', en: 'Line' },
  { id: 'curve', de: 'Kurve', en: 'Curve' },
  { id: 'ellipse', de: 'Ellipse', en: 'Oval' },
  { id: 'rect', de: 'Rechteck', en: 'Rectangle' },
  { id: 'rounded-rect', de: 'Abgerundetes Rechteck', en: 'Rounded rectangle' },
  { id: 'polygon', de: 'Polygon', en: 'Polygon' },
  { id: 'triangle', de: 'Dreieck', en: 'Triangle' },
  { id: 'right-triangle', de: 'Rechtwinkliges Dreieck', en: 'Right triangle' },
  { id: 'diamond', de: 'Raute', en: 'Diamond' },
  { id: 'pentagon', de: 'Fünfeck', en: 'Pentagon' },
  { id: 'hexagon', de: 'Sechseck', en: 'Hexagon' },
  { id: 'arrow-right', de: 'Pfeil rechts', en: 'Right arrow' },
  { id: 'arrow-left', de: 'Pfeil links', en: 'Left arrow' },
  { id: 'arrow-up', de: 'Pfeil oben', en: 'Up arrow' },
  { id: 'arrow-down', de: 'Pfeil unten', en: 'Down arrow' },
  { id: 'star-4', de: 'Stern 4-zackig', en: '4-point star' },
  { id: 'star-5', de: 'Stern 5-zackig', en: '5-point star' },
  { id: 'star-6', de: 'Stern 6-zackig', en: '6-point star' },
  { id: 'callout-rect', de: 'Rechteck-Sprechblase', en: 'Rectangular callout' },
  { id: 'callout-oval', de: 'Ellipsen-Sprechblase', en: 'Oval callout' },
  { id: 'callout-cloud', de: 'Wolken-Sprechblase', en: 'Cloud callout' },
  { id: 'heart', de: 'Herz', en: 'Heart' },
  { id: 'lightning', de: 'Blitz', en: 'Lightning' }
]

export const PALETTE = [
  '#000000',
  '#7f7f7f',
  '#880015',
  '#ed1c24',
  '#ff7f27',
  '#fff200',
  '#22b14c',
  '#00a2e8',
  '#3f48cc',
  '#a349a4',
  '#ffffff',
  '#c3c3c3',
  '#b97a57',
  '#ffaec9',
  '#ffc90e',
  '#efe4b0',
  '#b5e61d',
  '#99d9ea',
  '#7092be',
  '#c8bfe7'
]
