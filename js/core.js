(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WashCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA_VERSION = 2;
  const MAX_PHOTOS = 20;
  const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
  const MAX_STORED_PHOTO_BYTES = 5 * 1024 * 1024;
  const MAX_IMPORT_BYTES = 40 * 1024 * 1024;
  const TEXT_FIELDS = ['notes', 'problemDesc', 'associatedRisks', 'action', 'resources', 'responsible', 'responsibleId', 'revisionNotes', 'correctiveMeasures', 'monitoringComments'];
  const STATUSES = ['No Iniciado', 'En Progreso', 'Retrasado', 'Completado'];
  const MAX_PLAN_ACTIONS = 10;
  const PLAN_ACTION_TEXT_FIELDS = ['action', 'resources', 'responsible', 'responsibleId'];
  const CHANGES = ['', 'sin_cambios', 'mejorado', 'empeorado'];
  let sequence = 0;
  const newId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wash-${Date.now()}-${++sequence}`;
  const clone = value => JSON.parse(JSON.stringify(value));
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function validDate(value) {
    if (value === '') return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && localDate(date) === value;
  }
  function text(value, name, max = 20000) {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > max) throw new Error(`Campo inválido: ${name}.`);
    return value;
  }
  function number(value, name, min = 0, max = Number.MAX_SAFE_INTEGER, integer = false) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`Número inválido: ${name}.`);
    return value;
  }
  function option(value, name, choices, fallback = null) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!choices.includes(value)) throw new Error(`Opción inválida: ${name}.`);
    return value;
  }
  function date(value, name) {
    const result = text(value, name, 10);
    if (!validDate(result)) throw new Error(`Fecha inválida: ${name}.`);
    return result;
  }
  const countries = [['ARG','Argentina'],['BOL','Bolivia'],['BRA','Brasil'],['CHL','Chile'],['COL','Colombia'],['CRI','Costa Rica'],['CUB','Cuba'],['ECU','Ecuador'],['SLV','El Salvador'],['GTM','Guatemala'],['HTI','Haití'],['HND','Honduras'],['MEX','México'],['NIC','Nicaragua'],['PAN','Panamá'],['PRY','Paraguay'],['PER','Perú'],['DOM','República Dominicana'],['URY','Uruguay'],['VEN','Venezuela'],['CAN','Canadá'],['USA','Estados Unidos'],['BLZ','Belice'],['GUY','Guyana'],['SUR','Surinam'],['JAM','Jamaica'],['TTO','Trinidad y Tobago'],['BHS','Bahamas'],['BRB','Barbados'],['ATG','Antigua y Barbuda'],['DMA','Dominica'],['GRD','Granada'],['KNA','San Cristóbal y Nieves'],['LCA','Santa Lucía'],['VCT','San Vicente y las Granadinas']];
  const plain = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function countryCode(info) {
    if (countries.some(([code]) => code === info.countryCode)) return info.countryCode;
    const location = plain(info.district).split(/[^a-z]+/).filter(Boolean).join(' ');
    return countries.find(([,name]) => (' '+location+' ').includes(' '+plain(name)+' '))?.[0] || '';
  }
  function fileBaseName(info) {
    let words = plain(info.facilityName).split(/[^a-z0-9]+/).filter(word => word && !['de','del','la','las','los','el'].includes(word));
    let name = words.join('_').slice(0,120) || 'Sin_nombre';
    name = name[0].toUpperCase()+name.slice(1);
    return (countryCode(info) || 'SIN')+'-'+name;
  }
  function reportLocation(info) {
    const country = countries.find(([code]) => code === info.countryCode)?.[1] || '';
    return [String(info.district || '').trim(), country].filter(Boolean).join(' / ') || 'Sin registrar';
  }
  function filterRisks(list, domain, priority, order) {
    const risk = ind => ind.severity == null || ind.severity === '' || ind.likelihood == null || ind.likelihood === '' ? null : Number(ind.severity)+Number(ind.likelihood);
    const level = n => n === null ? 'pending' : n >= 15 ? 'high' : n >= 8 ? 'medium' : 'low';
    const result = list.filter(ind => (!domain || ind.moduleId === domain) && (!priority || level(risk(ind)) === priority));
    if(order !== 'none') result.sort((a,b) => {const x=risk(a),y=risk(b);if(x===null)return y===null?0:1;if(y===null)return -1;return order==='desc'?y-x:x-y;});
    return result;
  }
  function bulletEdit(value, caret = String(value || '').length) {
    const raw = String(value || '').replace(/\r\n/g, '\n');
    if (!raw) return {value: '', caret: 0};
    let offset = 0, outputOffset = 0, mapped = caret;
    const lines = raw.split('\n').map(line => {
      const prefix = line.match(/^[ \t]*(?:(?:[•*-][ \t]*)|(?:\d+[.)](?:[ \t]+|$)))?/)?.[0] || '';
      const result = '• ' + line.slice(prefix.length);
      if (caret >= offset && caret <= offset + line.length) mapped = outputOffset + Math.max(2, caret - offset + 2 - prefix.length);
      offset += line.length + 1;
      outputOffset += result.length + 1;
      return result;
    });
    const result = lines.join('\n');
    return {value: result, caret: Math.min(mapped, result.length)};
  }
  function bulletBackspace(value, start, end = start) {
    if (start !== end || start <= 0) return null;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const prefix = value.slice(lineStart).match(/^[ \t]*•[ \t]*/)?.[0];
    if (!prefix || start > lineStart + prefix.length) return null;
    const from = lineStart ? lineStart - 1 : 0;
    return {value: value.slice(0, from) + value.slice(lineStart + prefix.length), caret: from};
  }
  function bulletHasContent(value) { return String(value || '').split('\n').some(line => line.replace(/^[ \t]*•[ \t]*/, '').trim()); }
  function reviewBullets(value) { return bulletEdit(value).value.split('\n').filter(bulletHasContent).join('\n'); }
  function changeLabel(value) { return {mejorado: 'Ha mejorado', empeorado: 'Ha empeorado', sin_cambios: 'No ha cambiado'}[value] || 'Sin registrar'; }
  function defaults() {
    return {
      facilityName: '', district: '', countryCode: '', latitude: null, longitude: null,
      // El nivel inicial y sus opciones se conservan: punto 13 excluido.
      level: 'Primer Nivel', type: 'Público', setting: 'Urbano', populationServed: null,
      ageGroups: { under5: null, age5to17: null, over18to59: null, over60: null },
      sanitationSystem: null, selectedS9Option: null, evaluationDate: localDate(),
      summary: '', team: [], photos: [],
      jmpWater: { source: null, location: null, available: null },
      wasteTreatmentRoute: null, wasteSafeTreatment: null
    };
  }
  function normalizeGeneral(input) {
    if (!isObject(input)) throw new Error('Faltan los datos generales de la evaluación.');
    const info = defaults();
    for (const key of ['facilityName', 'district', 'summary']) info[key] = text(input[key], key);
    info.countryCode = option(input.countryCode, 'país', countries.map(([code]) => code), countryCode(input));
    info.level = option(input.level, 'nivel', ['Primer Nivel', 'Segundo Nivel', 'Tercer Nivel', 'Primer Nivel (Atención Primaria / Puesto de Salud)', 'Segundo Nivel (Atención Especializada / Hospital)', 'Tercer Nivel (Alta Especialización / Hospital Especializado)'], info.level);
    info.type = option(input.type, 'institución', ['Público', 'Privado'], info.type);
    info.setting = option(input.setting, 'ámbito', ['Urbano', 'Rural'], info.setting);
    info.latitude = number(input.latitude, 'latitud', -90, 90);
    info.longitude = number(input.longitude, 'longitud', -180, 180);
    info.populationServed = number(input.populationServed, 'población', 0, Number.MAX_SAFE_INTEGER, true);
    if (input.ageGroups !== undefined && !isObject(input.ageGroups)) throw new Error('Grupos etarios inválidos.');
    for (const key of Object.keys(info.ageGroups)) info.ageGroups[key] = number(input.ageGroups?.[key], key, 0, Number.MAX_SAFE_INTEGER, true);
    info.sanitationSystem = option(input.sanitationSystem, 'saneamiento', ['alcantarillado', 'insitu']);
    info.selectedS9Option = option(input.selectedS9Option, 'opción S9', ['S_9a', 'S_9b']);
    info.evaluationDate = input.evaluationDate === undefined ? info.evaluationDate : date(input.evaluationDate, 'evaluación');
    if (input.jmpWater !== undefined && !isObject(input.jmpWater)) throw new Error('Observación JMP de agua inválida.');
    info.jmpWater.source = option(input.jmpWater?.source, 'fuente de agua', ['improved', 'unimproved', 'none']);
    info.jmpWater.location = option(input.jmpWater?.location, 'ubicación de fuente', ['premises', 'near', 'far']);
    info.jmpWater.available = option(input.jmpWater?.available, 'disponibilidad de agua', ['yes', 'no']);
    info.wasteTreatmentRoute = option(input.wasteTreatmentRoute, 'ruta de residuos', ['external', 'onsite', 'none']);
    info.wasteSafeTreatment = option(input.wasteSafeTreatment, 'tratamiento seguro', ['yes', 'no']);
    if (input.team !== undefined && (!Array.isArray(input.team) || input.team.length > 100)) throw new Error('Equipo inválido o demasiado grande.');
    const ids = new Set();
    info.team = (input.team || []).map(member => {
      if (!isObject(member)) throw new Error('Integrante inválido.');
      const item = { id: text(member.id, 'ID de integrante', 200) || newId(), isEditing: member.isEditing === true };
      if (ids.has(item.id)) throw new Error('Integrante duplicado.');
      ids.add(item.id);
      for (const key of ['name', 'role', 'institution', 'responsibility', 'email']) item[key] = text(member[key], key, 1000);
      if (!item.isEditing && item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) throw new Error('Correo de integrante inválido.');
      return item;
    });
    if (input.photos !== undefined && (!Array.isArray(input.photos) || input.photos.length > MAX_PHOTOS)) throw new Error(`Máximo ${MAX_PHOTOS} fotografías.`);
    info.photos = (input.photos || []).map(photo => {
      if (!isObject(photo) || typeof photo.url !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(photo.url) || photo.url.length > MAX_STORED_PHOTO_BYTES * 4 / 3 + 100) throw new Error('Fotografía inválida o demasiado grande.');
      return { name: text(photo.name, 'nombre de foto', 1000), url: photo.url };
    });
    return info;
  }
  function answer(input) {
    if (!isObject(input)) throw new Error('Indicador inválido.');
    const result = {};
    for (const key of TEXT_FIELDS) result[key] = text(input[key], key);
    result.score = option(input.score, 'puntuación', [0, 1, 2]);
    result.assessmentStatus = option(input.assessmentStatus, 'estado de evaluación', ['not_applicable', 'no_information'], '');
    if (hasAssessmentScore(result)) result.assessmentStatus = '';
    for (const key of ['severity', 'likelihood']) result[key] = number(input[key], key, 0, 10, true);
    result.cost = number(input.cost, 'costo');
    for (const key of ['startDate', 'targetDate', 'nextReviewDate']) result[key] = date(input[key], key);
    validatePlanDates(result.startDate, result.targetDate);
    result.trackingStatus = option(input.trackingStatus, 'seguimiento', STATUSES, 'No Iniciado');
    result.indicatorChange = option(input.indicatorChange, 'cambio', CHANGES, 'sin_cambios');
    result.extraActions = extraPlanActions(input.extraActions);
    return result;
  }
  // La primera acción vive en los campos del indicador (compatibilidad con archivos anteriores); las demás, en extraActions.
  function extraPlanActions(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_PLAN_ACTIONS - 1) throw new Error(`Máximo ${MAX_PLAN_ACTIONS} acciones por indicador.`);
    const ids = new Set();
    return value.map(item => {
      if (!isObject(item)) throw new Error('Acción inválida.');
      const result = { id: text(item.id, 'id de acción', 200) || newId() };
      if (ids.has(result.id)) result.id = newId();
      ids.add(result.id);
      for (const key of PLAN_ACTION_TEXT_FIELDS) result[key] = text(item[key], key);
      result.cost = number(item.cost, 'costo');
      for (const key of ['startDate', 'targetDate']) result[key] = date(item[key], key);
      validatePlanDates(result.startDate, result.targetDate);
      result.trackingStatus = option(item.trackingStatus, 'seguimiento', STATUSES, 'No Iniciado');
      return result;
    });
  }
  function newPlanAction() {
    return { id: newId(), action: '', resources: '', responsible: '', responsibleId: '', cost: null, startDate: '', targetDate: '', trackingStatus: 'No Iniciado' };
  }
  // Devuelve los "titulares" de cada acción: el propio indicador (primera acción) y las acciones adicionales.
  function planActions(indicator) {
    return [indicator, ...(Array.isArray(indicator.extraActions) ? indicator.extraActions : [])];
  }
  function addPlanAction(indicator) {
    if (!Array.isArray(indicator.extraActions)) indicator.extraActions = [];
    if (indicator.extraActions.length >= MAX_PLAN_ACTIONS - 1) throw new Error(`Máximo ${MAX_PLAN_ACTIONS} acciones por indicador.`);
    const action = newPlanAction();
    indicator.extraActions.push(action);
    return action;
  }
  // Quitar la primera acción promueve la siguiente a los campos del indicador.
  function removePlanAction(indicator, index) {
    const extras = indicator.extraActions || [];
    if (!extras.length || index < 0 || index > extras.length) return;
    if (index === 0) {
      const next = extras.shift();
      for (const key of [...PLAN_ACTION_TEXT_FIELDS, 'cost', 'startDate', 'targetDate', 'trackingStatus']) indicator[key] = next[key];
    } else {
      extras.splice(index - 1, 1);
    }
  }
  function normalizeDataset(input, catalog) {
    if (!isObject(input) || !Array.isArray(input.indicators)) throw new Error('El JSON debe contener datos generales y una lista de indicadores.');
    if (input.schemaVersion !== undefined && ![1, SCHEMA_VERSION].includes(input.schemaVersion)) throw new Error('Versión de archivo no compatible.');
    const generalInfo = normalizeGeneral(input.generalInfo);
    if (input.indicators.length > catalog.length) throw new Error('Cantidad de indicadores inválida.');
    const codes = new Set(catalog.map(item => item.code));
    const imported = new Map();
    // En catálogos anteriores, S_8 guardaba la contención que ahora corresponde a S_8b.
    const legacyContainment = !input.indicators.some(item => item?.code === 'S_8b');
    for (const source of input.indicators) {
      const item = legacyContainment && source?.code === 'S_8' ? { ...source, code: 'S_8b' } : source;
      if (!isObject(item) || !codes.has(item.code) || imported.has(item.code)) throw new Error('Código de indicador desconocido o duplicado.');
      const normalized = answer(item);
      if (item.history !== undefined && (!Array.isArray(item.history) || item.history.length > 200)) throw new Error('Historial inválido o demasiado grande.');
      normalized.history = (item.history || []).map(entry => {
        if (!isObject(entry) || typeof entry.recordedAt !== 'string' || !Number.isFinite(Date.parse(entry.recordedAt))) throw new Error('Fecha del historial inválida.');
        const result = { recordedAt: entry.recordedAt, ...answer(entry) };
        if (entry.reviewChanges !== undefined) {
          const changes = entry.reviewChanges;
          if (!isObject(changes) || typeof changes.responsibleChanged !== 'boolean') throw new Error('Cambios de revisión inválidos.');
          result.reviewChanges = {responsibleChanged: changes.responsibleChanged, previousResponsible: text(changes.previousResponsible, 'responsable anterior'), newCorrectiveMeasures: text(changes.newCorrectiveMeasures, 'nueva medida correctiva'), newMonitoringComments: text(changes.newMonitoringComments, 'nuevo comentario')};
        }
        return result;
      });
      if (!normalized.responsibleId && normalized.responsible) {
        const matches = generalInfo.team.filter(member => member.name === normalized.responsible);
        if (matches.length === 1) normalized.responsibleId = matches[0].id;
      }
      if (normalized.responsibleId && !generalInfo.team.some(member => member.id === normalized.responsibleId)) normalized.responsibleId = '';
      for (const extra of normalized.extraActions) {
        if (!extra.responsibleId && extra.responsible) {
          const matches = generalInfo.team.filter(member => member.name === extra.responsible);
          if (matches.length === 1) extra.responsibleId = matches[0].id;
        }
        if (extra.responsibleId && !generalInfo.team.some(member => member.id === extra.responsibleId)) extra.responsibleId = '';
      }
      imported.set(item.code, normalized);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      generalInfo,
      indicators: catalog.map(item => ({ ...clone(item), ...answer(item), history: [], ...(imported.get(item.code) || {}) }))
    };
  }
  function populationWarning(info) {
    const values = Object.values(info.ageGroups);
    const sum = values.reduce((acc, value) => acc + (value || 0), 0);
    if (info.populationServed !== null && (sum > info.populationServed || (values.every(value => value !== null) && sum !== info.populationServed))) return 'La suma de los grupos etarios no coincide con la población total.';
    return '';
  }
  function parseNonNegative(value, integer = false) {
    const clean = String(value).replace(/,/g, '').trim();
    if (!clean) return null;
    if (!(integer ? /^\d+$/ : /^\d+(\.\d{0,2})?$/).test(clean)) return undefined;
    const valueNumber = Number(clean);
    return Number.isFinite(valueNumber) && valueNumber <= Number.MAX_SAFE_INTEGER ? valueNumber : undefined;
  }
  function service(status, reason = '') {
    const styles = {
      'Básico': 'bg-emerald-50 text-emerald-800 border-emerald-300',
      'Limitado': 'bg-amber-50 text-amber-800 border-amber-300',
      'Sin Servicio': 'bg-red-50 text-red-800 border-red-300',
      'Sin evaluar': 'bg-gray-50 text-gray-600 border-gray-300',
      'Evaluación incompleta': 'bg-gray-50 text-gray-600 border-gray-300'
    };
    return { status, class: styles[status], reason };
  }
  function calculateJmp(info, indicators) {
    const rawScore = code => indicators.find(item => item.code === code)?.score ?? null;
    // Solo para JMP, las respuestas vacías cuentan como rojo por decisión del propietario.
    const score = code => rawScore(code) ?? 0;
    const hospital = /segundo|tercer|secundari|terciari/.test((info.level || '').toLocaleLowerCase('es'));
    const sourceScore = score(hospital ? 'A_1b' : 'A_1a');
    const availability = score('A_3');
    // Equivalencias numéricas de la matriz aprobadas por el propietario.
    const water = service(sourceScore === 0 ? 'Sin Servicio' : availability >= 1 ? 'Básico' : 'Limitado');
    const san = ['S_1', 'S_2', 'S_4', 'S_5', 'S_6', 'S_7'].map(score);
    const sanitation = service(san[0] === 0 || san[1] === 0 ? 'Sin Servicio' : san.every(value => value >= 1) ? 'Básico' : 'Limitado');
    const hygieneScores = [score('H_1'), score('S_3')];
    const hygiene = service(hygieneScores.every(value => value >= 1) ? 'Básico' : hygieneScores.some(value => value >= 1) ? 'Limitado' : 'Sin Servicio');
    const route = info.wasteTreatmentRoute;
    const segregation = score('RES_2');
    let treatment = 0;
    if (route === 'external') treatment = score('RES_12');
    else if (route === 'onsite') treatment = score('RES_10');
    else {
      // Sin ruta explícita, se usan los tratamientos evaluados; si hay dos, ambos deben cumplir.
      const evaluated = [rawScore('RES_10'), rawScore('RES_12')].filter(value => value !== null);
      if (evaluated.length) treatment = Math.min(...evaluated);
    }
    const waste = service(segregation >= 1 && treatment >= 1 ? 'Básico' : segregation >= 1 || treatment >= 1 ? 'Limitado' : 'Sin Servicio');
    const cleaningScores = [score('L_1'), score('L_5')];
    const cleaning = service(cleaningScores[0] >= 1 && cleaningScores[1] === 2 ? 'Básico' : cleaningScores.some(value => value >= 1) ? 'Limitado' : 'Sin Servicio');
    return { water, sanitation, hygiene, waste, cleaning };
  }
  function valuation(answered, total, compliance) {
    if (!answered) return { label: 'Sin evaluar', colorClass: 'text-paho-gray-dark' };
    return compliance > 75 ? { label: 'Mejora Avanzada', colorClass: 'text-emerald-700' } : compliance >= 60 ? { label: 'En Proceso de Mejora', colorClass: 'text-amber-700' } : { label: 'Requiere Mejoras Prioritarias', colorClass: 'text-rose-700' };
  }
  function hasAssessmentScore(indicator) { return [0, 1, 2].includes(indicator.score); }
  function sortReportByAssessment(indicators) {
    const rank = indicator => hasAssessmentScore(indicator) ? indicator.score : 3;
    return indicators.slice().sort((a, b) => rank(a) - rank(b));
  }
  function hasAssessmentExplanation(indicator) {
    const reason = String(indicator.notes || '').trim()
      .replace(/^(?:INDICADOR\s+)?NO\s+(?:SE\s+)?APLICA\b[\s:;,.()—-]*/i, '')
      .replace(/^XQ\b[\s:;,.()—-]*/i, '');
    return /\p{L}/u.test(reason);
  }
  function isNotApplicable(indicator) {
    return !hasAssessmentScore(indicator) && indicator.assessmentStatus === 'not_applicable' && hasAssessmentExplanation(indicator);
  }
  function assessmentResult(value) {
    const indicator = typeof value === 'object' && value !== null ? value : {score: value};
    const score = indicator.score;
    if (score === 2) return { label: 'Cumple', class: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    if (score === 1) return { label: 'Cumple Parcialmente', class: 'bg-amber-50 text-amber-800 border-amber-300' };
    if (score === 0) return { label: 'No Cumple', class: 'bg-rose-50 text-rose-700 border-rose-300' };
    const label = isNotApplicable(indicator) ? 'No se aplica' : hasAssessmentExplanation(indicator) ? (indicator.assessmentStatus === 'no_information' ? 'Sin información' : 'Sin puntaje, con justificación') : 'Sin evaluar';
    return { label, class: 'bg-gray-50 text-gray-600 border-gray-300' };
  }
  function assessmentComplete(indicator) {
    return hasAssessmentScore(indicator) || hasAssessmentExplanation(indicator);
  }
  function responsibleName(indicator, team) {
    return team.find(member => member.id === indicator.responsibleId)?.name || indicator.responsible || '';
  }
  function validatePlanDates(startDate, targetDate) {
    const start = date(startDate, 'fecha de inicio');
    const end = date(targetDate, 'fecha de finalización');
    if (start && end && end < start) throw new Error('La fecha de finalización no puede ser anterior a la fecha de inicio.');
  }
  function updatePlanDate(indicator, field, value) {
    if (!['startDate', 'targetDate'].includes(field)) throw new Error('Campo de fecha no válido.');
    const candidate = { ...indicator, [field]: date(value, field) };
    validatePlanDates(candidate.startDate, candidate.targetDate);
    indicator[field] = candidate[field];
  }
  function actionStatus(action, today = localDate()) {
    if (action.trackingStatus === 'Completado') return 'Completado';
    if (action.targetDate && action.targetDate < today) return 'Retrasado';
    return action.trackingStatus || 'No Iniciado';
  }
  // Plazo vencido: la fecha de finalización ya pasó y la acción no está completada.
  function isOverdue(action, today = localDate()) {
    return action.trackingStatus !== 'Completado' && !!action.targetDate && action.targetDate < today;
  }
  // Estado del indicador a partir de todas sus acciones (con una sola acción coincide con el estado de esa acción).
  function trackingStatus(indicator, today = localDate()) {
    const statuses = planActions(indicator).map(action => actionStatus(action, today));
    if (statuses.every(status => status === 'Completado')) return 'Completado';
    if (statuses.includes('Retrasado')) return 'Retrasado';
    if (statuses.includes('En Progreso') || statuses.includes('Completado')) return 'En Progreso';
    return 'No Iniciado';
  }
  // Resumen del plan de un indicador: cantidad, rango de fechas, costo total y acciones retrasadas.
  function planSummary(indicator, today = localDate()) {
    const actions = planActions(indicator);
    const starts = actions.map(action => action.startDate).filter(Boolean).sort();
    const ends = actions.map(action => action.targetDate).filter(Boolean).sort();
    return {
      count: actions.length,
      startDate: starts[0] || '',
      targetDate: ends[ends.length - 1] || '',
      cost: actions.reduce((sum, action) => sum + (action.cost || 0), 0),
      delayed: actions.filter(action => actionStatus(action, today) === 'Retrasado').length
    };
  }
  // Texto único de las acciones, para seguimiento (Paso 5) e historial: con varias acciones se numeran.
  function actionsText(indicator) {
    const texts = planActions(indicator).map(action => String(action.action || '').trim());
    if (texts.filter(Boolean).length <= 1) return texts.find(Boolean) || '';
    return texts.map((value, index) => value ? `Acción ${index + 1}:\n${value}` : '').filter(Boolean).join('\n\n');
  }
  const DAY_MS = 86400000;
  const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dayNumber = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY_MS); };
  const weekdayOf = day => (new Date(day * DAY_MS).getUTCDay() + 6) % 7;
  const firstActionLine = value => String(value || '').split('\n').map(line => line.replace(/^\s*[•\-–]\s*/, '').trim()).find(Boolean) || '';
  // Cronograma: solo se dibujan acciones con ambas fechas; el eje va de lunes a domingo y llega hasta "hoy" si está cerca.
  function buildGantt(items, today = localDate()) {
    const rows = (items || []).filter(item => item.startDate && item.targetDate && item.startDate <= item.targetDate);
    if (!rows.length) return { rows: [], weeks: [], years: [], months: [], totalDays: 0, todayOffset: null };
    let first = Math.min(...rows.map(item => dayNumber(item.startDate)));
    let last = Math.max(...rows.map(item => dayNumber(item.targetDate)));
    const todayDay = dayNumber(today);
    const nearToday = todayDay >= first - 28 && todayDay <= last + 28;
    if (nearToday) { first = Math.min(first, todayDay); last = Math.max(last, todayDay); }
    first -= weekdayOf(first);
    last += 6 - weekdayOf(last);
    while ((last - first + 1) / 7 < 4) last += 7;
    const weeks = [];
    for (let day = first; day <= last; day += 7) { const date = new Date(day * DAY_MS); weeks.push(`${date.getUTCDate()} ${MONTHS_ES[date.getUTCMonth()]}`); }
    // Años y meses consecutivos con su cantidad de días dentro del eje (para las dos filas del encabezado).
    const years = [], months = [];
    for (let day = first; day <= last; day++) {
      const date = new Date(day * DAY_MS), year = date.getUTCFullYear(), month = date.getUTCMonth();
      const lastYear = years[years.length - 1], lastMonth = months[months.length - 1];
      if (lastYear && lastYear.year === year) lastYear.days++; else years.push({ year, days: 1 });
      if (lastMonth && lastMonth.year === year && lastMonth.month === month) lastMonth.days++; else months.push({ year, month, label: MONTHS_ES[month], days: 1 });
    }
    return {
      weeks, years, months,
      totalDays: last - first + 1,
      todayOffset: todayDay >= first && todayDay <= last ? todayDay - first : null,
      rows: rows.map((item, index) => {
        const groupId = item.groupId ?? item.id;
        const groupStart = index === 0 || (rows[index - 1].groupId ?? rows[index - 1].id) !== groupId;
        let groupSize = 1;
        if (groupStart) while (index + groupSize < rows.length && (rows[index + groupSize].groupId ?? rows[index + groupSize].id) === groupId) groupSize++;
        return { ...item, groupStart, groupSize, actionText: firstActionLine(item.action), offset: dayNumber(item.startDate) - first, days: dayNumber(item.targetDate) - dayNumber(item.startDate) + 1 };
      })
    };
  }
  function recordReview(indicator, team, now = new Date().toISOString()) {
    if ((indicator.history || []).length >= 200) throw new Error('Máximo 200 revisiones por indicador. Exporte un respaldo antes de iniciar otra evaluación.');
    const snapshot = { recordedAt: now, ...answer(indicator), responsible: responsibleName(indicator, team), trackingStatus: trackingStatus(indicator) };
    indicator.history = [...(indicator.history || []), snapshot];
    return snapshot;
  }
  function createReviewDraft(indicator, team) {
    const previous = indicator.history?.at(-1);
    return {indicatorChange: previous?.indicatorChange || indicator.indicatorChange || 'sin_cambios', responsible: reviewBullets(responsibleName(indicator, team)), previousCorrectiveMeasures: previous?.correctiveMeasures || indicator.correctiveMeasures || '', previousMonitoringComments: previous?.monitoringComments || indicator.monitoringComments || '', newCorrectiveMeasures: '', newMonitoringComments: '', nextReviewDate: previous?.nextReviewDate || indicator.nextReviewDate || ''};
  }
  function appendReviewText(previous, addition) {
    const added = reviewBullets(addition).replace(/^•(?:[ \t]*•)+[ \t]*/gm, '• ');
    if (!added) return previous || '';
    return previous ? previous + (previous.endsWith('\n') ? '' : '\n') + added : added;
  }
  function saveReviewDraft(indicator, draft, team, now = new Date().toISOString()) {
    const candidate = clone(indicator);
    for (const field of ['indicatorChange', 'correctiveMeasures', 'monitoringComments', 'nextReviewDate']) candidate[field] = draft[field];
    if (Object.hasOwn(draft, 'newCorrectiveMeasures')) candidate.correctiveMeasures = appendReviewText(indicator.history?.at(-1)?.correctiveMeasures || indicator.correctiveMeasures || '', draft.newCorrectiveMeasures);
    if (Object.hasOwn(draft, 'newMonitoringComments')) candidate.monitoringComments = appendReviewText(indicator.history?.at(-1)?.monitoringComments || indicator.monitoringComments || '', draft.newMonitoringComments);
    recordReview(candidate, team, now);
    const entry = candidate.history.at(-1);
    entry.trackingStatus = trackingStatus(indicator, '0000-00-00');
    entry.responsible = text(draft.responsible, 'responsable de revisión');
    entry.responsibleId = '';
    entry.reviewChanges = {responsibleChanged: reviewBullets(entry.responsible) !== reviewBullets(responsibleName(indicator, team)), previousResponsible: responsibleName(indicator, team), newCorrectiveMeasures: reviewBullets(draft.newCorrectiveMeasures || '').replace(/^•(?:[ \t]*•)+[ \t]*/gm, '• '), newMonitoringComments: reviewBullets(draft.newMonitoringComments || '').replace(/^•(?:[ \t]*•)+[ \t]*/gm, '• ')};
    indicator.history = candidate.history;
    return candidate.history.at(-1);
  }
  function reviewHistoryText(entry, field) {
    const full = reviewBullets(entry[field]) || '—';
    const changes = entry.reviewChanges;
    if (!changes) return full;
    if (field === 'responsible') return (changes.responsibleChanged ? 'Modificados en esta revisión:\n' : 'Del Plan de mejora:\n') + full;
    const added = field === 'correctiveMeasures' ? changes.newCorrectiveMeasures : changes.newMonitoringComments;
    return (added ? 'Nuevo en esta revisión:\n' + reviewBullets(added) : 'Sin información nueva en esta revisión.') + '\n\nAcumulado:\n' + full;
  }
  return { MAX_PLAN_ACTIONS, newPlanAction, planActions, addPlanAction, removePlanAction, isOverdue, actionStatus, planSummary, actionsText, buildGantt, validatePlanDates, updatePlanDate, sortReportByAssessment, reportLocation, hasAssessmentScore, hasAssessmentExplanation, isNotApplicable, assessmentComplete, bulletBackspace, reviewHistoryText, createReviewDraft, saveReviewDraft, reviewBullets, changeLabel, bulletEdit, bulletHasContent, countries, countryCode, fileBaseName, filterRisks, SCHEMA_VERSION, MAX_PHOTOS, MAX_PHOTO_BYTES, MAX_IMPORT_BYTES, clone, newId, localDate, validDate, defaults, normalizeDataset, calculateJmp, valuation, assessmentResult, populationWarning, parseNonNegative, responsibleName, trackingStatus, recordReview };
});
