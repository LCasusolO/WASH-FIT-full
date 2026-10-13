const { createApp, ref, computed, onMounted, nextTick, watch } = Vue;

// Función auxiliar de compresión y redimensionado usando HTML5 Canvas
const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Redimensionar proporcionalmente
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a Base64 JPEG comprimido
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };

      img.onerror = (error) => reject(error);
    };

    reader.onerror = (error) => reject(error);
  });
};

createApp({
  setup() {
    // Active Navigation state
    const activeView = ref('instructions');
    const activeModuleTab = ref('water');
    const mobileMenuOpen = ref(false);
    
    const filterOnlyGaps = ref(false); 
    const countries = WashCore.countries;
    const sortRiskOrder = ref('none'); // 'none' | 'desc' | 'asc'
    const sidebarCollapsed = ref(false);
    const isPrintingAll = ref(false);

    // Estado y controles para la ventana modal (Lightbox) de fotografías
    const selectedPhoto = ref(null);

    const openPhotoModal = (photo) => {
      photoOrigin = document.activeElement;
      selectedPhoto.value = photo;
      nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
        document.getElementById('photo-close')?.focus();
      });
    };

    const closePhotoModal = () => {
      selectedPhoto.value = null;
      nextTick(() => photoOrigin?.focus());
    };

    // Opciones para el Nivel de Atención del Establecimiento
    const levelOptions = [
      'Primer Nivel (Atención Primaria / Puesto de Salud)',
      'Segundo Nivel (Atención Especializada / Hospital)',
      'Tercer Nivel (Alta Especialización / Hospital Especializado)'
    ];

    // Toast Notifications helper state
    const toast = ref({
      show: false,
      message: '',
      type: 'success'
    });

    const triggerToast = (message, type = 'success') => {
      toast.value.message = message;
      toast.value.type = type;
      toast.value.show = true;
      setTimeout(() => {
        toast.value.show = false;
      }, 4000);
    };

    // Lista completa de los 7 módulos WASH-FIT
    const modulesList = [
      { id: 'water', name: 'Agua', shortName: 'Agua (A)', color: 'bg-paho-blue', hex: '#008DC9' },
      { id: 'sanitation', name: 'Saneamiento', shortName: 'Saneam. (S)', color: 'bg-emerald-600', hex: '#059669' },
      { id: 'waste', name: 'Gestión de Residuos', shortName: 'Residuos (RES)', color: 'bg-amber-600', hex: '#d97706' },
      { id: 'hygiene', name: 'Higiene de Manos', shortName: 'Higiene (H)', color: 'bg-purple-600', hex: '#7c3aed' },
      { id: 'cleaning', name: 'Limpieza Hospitalaria', shortName: 'Limpieza (L)', color: 'bg-teal-600', hex: '#0d9488' },
      { id: 'energy', name: 'Energía', shortName: 'Energía (E)', color: 'bg-yellow-500', hex: '#eab308' },
      { id: 'management', name: 'Gestión y Administración', shortName: 'Gestión (M)', color: 'bg-indigo-600', hex: '#4f46e5' }
    ];

    // Opciones oficiales de la escala de Gravedad (0 a 10)
    const severityOptions = [
      { val: 0, label: '0 - Nula' },
      { val: 1, label: '1 - Insignificante' },
      { val: 2, label: '2 - Muy baja' },
      { val: 3, label: '3 - Baja' },
      { val: 4, label: '4 - Moderada-baja' },
      { val: 5, label: '5 - Moderada' },
      { val: 6, label: '6 - Moderada-alta' },
      { val: 7, label: '7 - Alta' },
      { val: 8, label: '8 - Muy alta' },
      { val: 9, label: '9 - Crítica' },
      { val: 10, label: '10 - Catastrófica' }
    ];

    // Opciones oficiales de la escala de Probabilidad (0 a 10)
    const likelihoodOptions = [
      { val: 0, label: '0 - Imposible' },
      { val: 1, label: '1 - Extremadamente rara' },
      { val: 2, label: '2 - Muy rara' },
      { val: 3, label: '3 - Rara' },
      { val: 4, label: '4 - Poco probable' },
      { val: 5, label: '5 - Ocasional' },
      { val: 6, label: '6 - Moderadamente probable' },
      { val: 7, label: '7 - Probable' },
      { val: 8, label: '8 - Muy probable' },
      { val: 9, label: '9 - Casi segura' },
      { val: 10, label: '10 - Continua' }
    ];

    const generalInfo = ref(WashCore.defaults());
    const indicators = ref(WashCore.clone(INDICATORS_DATA));
    const loadingDraft = ref(true);
    const saveState = ref('loading');
    const savedAt = ref('');
    const hasBackup = ref(false);
    const isOnline = ref(navigator.onLine);
    const offlineReady = ref(false);
    const updateAvailable = ref(false);
    let serviceRegistration = null;
    const photoBusy = ref(false);
    const reportPreview = ref(false);
    const isMobile = ref(window.innerWidth < 1024);
    const populationWarning = computed(() => WashCore.populationWarning(generalInfo.value));
    const store = WashStorage.createStore(window.indexedDB);
    let saveTimer;
    let saveQueue = Promise.resolve();
    let revision = 0;
    let persistedRevision = 0;
    let photoOrigin = null;
    const snapshot = () => ({ schemaVersion: WashCore.SCHEMA_VERSION, savedAt: new Date().toISOString(), generalInfo: WashCore.clone(generalInfo.value), indicators: WashCore.clone(indicators.value) });
    const saveDraft = (backup = false) => {
      clearTimeout(saveTimer);
      const dataset = snapshot();
      const savingRevision = revision;
      saveState.value = 'saving';
      saveQueue = saveQueue.catch(() => {}).then(() => store.save(dataset, backup)).then(time => {
        persistedRevision = savingRevision;
        savedAt.value = time;
        saveState.value = savingRevision === revision ? 'saved' : 'pending';
        if (backup) hasBackup.value = true;
        return true;
      }).catch(() => { saveState.value = 'error'; return false; });
      return saveQueue;
    };
    watch([generalInfo, indicators], () => {
      if (loadingDraft.value) return;
      revision++;
      saveState.value = 'pending';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveDraft(), 800);
    }, { deep: true, flush: 'sync' });
    const applyDataset = (dataset) => {
      generalInfo.value = dataset.generalInfo;
      indicators.value = dataset.indicators.map(ind => ({...ind, responsible: WashCore.responsibleName(ind, dataset.generalInfo.team), responsibleId: ''}));
      nextTick(() => { onCoordinatesInput(); if (window.lucide) window.lucide.createIcons(); });
    };
    const newEvaluation = async () => {
      if (!window.confirm('Se guardará el borrador actual como respaldo y se abrirá una evaluación nueva. ¿Continuar?')) return;
      if (!await saveDraft(true)) { triggerToast('No se pudo guardar el respaldo. Exporte el JSON antes de comenzar otra evaluación.', 'error'); return; }
      applyDataset({ generalInfo: WashCore.defaults(), indicators: WashCore.clone(INDICATORS_DATA) });
      await saveDraft();
    };
    const restoreBackup = async () => {
      try {
        const backup = await store.read('backup');
        if (!backup) throw new Error('No hay un respaldo previo.');
        const restored = WashCore.normalizeDataset(backup, INDICATORS_DATA);
        if (!window.confirm('Se recuperará el respaldo anterior. El borrador actual quedará como respaldo. ¿Continuar?')) return;
        if (!await saveDraft(true)) throw new Error('No se pudo conservar el borrador actual.');
        applyDataset(restored);
        await saveDraft();
        triggerToast('Respaldo recuperado.');
      } catch (error) { triggerToast(error.message, 'error'); }
    };
    const saveLabel = computed(() => {
      if (saveState.value === 'loading') return 'Recuperando…';
      if (saveState.value === 'error') return 'Error al guardar.';
      if (saveState.value !== 'saved') return 'Guardando…';
      return savedAt.value ? 'Guardado a las ' + new Date(savedAt.value).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : 'Listo';
    });
    const updateApplication = async () => {
      if (!serviceRegistration?.waiting) return;
      if (!await saveDraft()) { triggerToast('Guarde un respaldo antes de actualizar: el borrador no pudo guardarse.', 'error'); return; }
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
      serviceRegistration.waiting.postMessage('activate-update');
    };

    // Los nombres son etiquetas; las relaciones y los cálculos usan IDs estables.
    // El fallback permite abrir JSON anteriores que solo incluían `module`.
    const getIndicatorModuleId = (ind) => {
      if (modulesList.some(mod => mod.id === ind.moduleId)) return ind.moduleId;
      return MODULE_ID_BY_NAME[ind.module];
    };

    const answeredCount = computed(() => {
      return indicators.value.filter(ind => shouldShowIndicator(ind) && ind.score !== null).length;
    });

    const totalVisibleIndicators = computed(() => {
      return indicators.value.filter(ind => shouldShowIndicator(ind)).length;
    });

    const progressPercentage = computed(() => {
      if (totalVisibleIndicators.value === 0) return 0;
      return Math.round((answeredCount.value / totalVisibleIndicators.value) * 100);
    });

    const totalGaps = computed(() => {
      return indicators.value.filter(ind => shouldShowIndicator(ind) && (ind.score === 0 || ind.score === 1)).length;
    });

    const totalScoreAchieved = computed(() => {
      return indicators.value.reduce((acc, ind) => {
        return acc + (shouldShowIndicator(ind) && ind.score !== null ? ind.score : 0);
      }, 0);
    });

    const overallCompliance = computed(() => {
      const evaluated = indicators.value.filter(ind => shouldShowIndicator(ind) && ind.score !== null);
      if (evaluated.length === 0) return 0;
      const maxPossible = evaluated.length * 2;
      const sum = evaluated.reduce((acc, ind) => acc + ind.score, 0);
      return Math.round((sum / maxPossible) * 100);
    });

    const getFilteredIndicatorsByModule = computed(() => {
      const dom = modulesList.find(d => d.id === activeModuleTab.value);
      if (!dom) return [];
      return indicators.value.filter(ind => getIndicatorModuleId(ind) === dom.id && shouldShowIndicator(ind));
    });

    const getActiveModuleProgressPercentage = computed(() => {
      const moduleId = activeModuleTab.value;
      const total = getModuleTotalCount(moduleId);
      if (total === 0) return 0;
      return Math.round((getModuleAnsweredCount(moduleId) / total) * 100);
    });

    const toggleRiskSort = () => {
      if (sortRiskOrder.value === 'none') {
        sortRiskOrder.value = 'desc';
      } else if (sortRiskOrder.value === 'desc') {
        sortRiskOrder.value = 'asc';
      } else {
        sortRiskOrder.value = 'none';
      }
    };

    // Cálculo oficial: Riesgo Total = Gravedad (G) + Probabilidad (P)
    const calculateRiskScore = (ind) => {
      if (
        ind.severity === null || 
        ind.severity === undefined || 
        ind.severity === '' || 
        ind.likelihood === null || 
        ind.likelihood === undefined || 
        ind.likelihood === ''
      ) {
        return null;
      }
      return Number(ind.severity) + Number(ind.likelihood);
    };

    // Escala oficial: 0-7 Bajo | 8-14 Medio | 15-20 Alto
    const getRiskColorClass = (score) => {
      if (score === null || score === undefined) return 'bg-gray-50 text-gray-400 border-gray-200';
      if (score >= 15) return 'bg-red-50 text-red-700 border-red-300';
      if (score >= 8) return 'bg-amber-50 text-amber-800 border-amber-300';
      return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    };

    const getRiskLabel = (score) => {
      if (score === null || score === undefined) return 'Sin evaluar';
      if (score >= 15) return 'Alto';
      if (score >= 8) return 'Medio';
      return 'Bajo';
    };

    const getRiskMeaning = (score) => {
      if (score === null || score === undefined) return '';
      if (score >= 15) return 'Riesgo inaceptable con probabilidad elevada de daños importantes.';
      if (score >= 8) return 'Riesgo significativo que puede afectar la calidad del servicio o la salud.';
      return 'Riesgo aceptable con impacto limitado.';
    };

    const getSortedGaps = computed(() => {
      let list = indicators.value.filter(ind => shouldShowIndicator(ind));
      if (filterOnlyGaps.value) {
        list = list.filter(ind => ind.score === 0 || ind.score === 1);
      } else {
        list = list.filter(ind => ind.score !== null);
      }
      
      let result = [...list];

      if (sortRiskOrder.value !== 'none') {
        result.sort((a, b) => {
          const scoreA = calculateRiskScore(a);
          const scoreB = calculateRiskScore(b);
          const riskA = scoreA !== null ? scoreA : -1;
          const riskB = scoreB !== null ? scoreB : -1;
          return sortRiskOrder.value === 'desc' ? riskB - riskA : riskA - riskB;
        });
      }

      return result;
    });

    const trackingSummary = computed(() => {
      const gaps = indicators.value.filter(ind => shouldShowIndicator(ind) && (ind.score === 0 || ind.score === 1));
      const counts = { noIniciado: 0, enProgreso: 0, completado: 0, retrasado: 0 };
      gaps.forEach(g => {
        if (getTrackingStatus(g) === 'En Progreso') counts.enProgreso++;
        else if (getTrackingStatus(g) === 'Completado') counts.completado++;
        else if (getTrackingStatus(g) === 'Retrasado') counts.retrasado++;
        else counts.noIniciado++;
      });
      return counts;
    });

    const planProgressPercentage = computed(() => {
      const gaps = indicators.value.filter(ind => shouldShowIndicator(ind) && (ind.score === 0 || ind.score === 1));
      if (gaps.length === 0) return 0;
      const completed = gaps.filter(g => getTrackingStatus(g) === 'Completado').length;
      const inProgress = gaps.filter(g => getTrackingStatus(g) === 'En Progreso').length;
      const score = (completed * 1.0) + (inProgress * 0.5);
      return Math.round((score / gaps.length) * 100);
    });

    const focusedCostId = ref(null);
    const isPopFocused = ref(false);

    const updatePopulation = value => {
      const parsed = WashCore.parseNonNegative(value, true);
      if (parsed === undefined) { triggerToast('Ingrese una población entera y no negativa.', 'error'); return; }
      generalInfo.value.populationServed = parsed;
    };

    const focusedAgeGroup = ref(null);

    const updateAgeGroup = (key, value) => {
      const parsed = WashCore.parseNonNegative(value, true);
      if (parsed === undefined) { triggerToast('Ingrese una cantidad entera y no negativa.', 'error'); return; }
      generalInfo.value.ageGroups[key] = parsed;
    };

    const formatThousands = (val) => {
      if (val === null || val === undefined || val === '') return '';
      return new Intl.NumberFormat('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
      }).format(val);
    };

    const updateCost = (ind, value) => {
      const parsed = WashCore.parseNonNegative(value);
      if (parsed === undefined) { triggerToast('Ingrese un costo no negativo con hasta dos decimales.', 'error'); return; }
      ind.cost = parsed;
    };

    const jmpCalculatedStatus = computed(() => WashCore.calculateJmp(generalInfo.value, indicators.value));

    // Gráfico de radar dinámico para N módulos
    const radarChartData = computed(() => {
      const cx = 375;
      const cy = 240;
      const rMax = 150;
      const n = modulesList.length;
      const angles = modulesList.map((_, i) => (i * 2 * Math.PI / n) - Math.PI / 2);
      
      const levels = [20, 40, 60, 80, 100].map(levelPercent => {
        const r = rMax * (levelPercent / 100);
        return angles.map(angle => ({
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle)
        }));
      });

      const axes = angles.map(angle => ({
        x1: cx,
        y1: cy,
        x2: cx + rMax * Math.cos(angle),
        y2: cy + rMax * Math.sin(angle)
      }));

      const points = modulesList.map((mod, i) => {
        const pct = getModulePercentage(mod.id);
        const r = rMax * (pct / 100);
        const angle = angles[i];
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        
        const labelRadius = rMax + 18;
        let lx = cx + labelRadius * Math.cos(angle);
        let ly = cy + labelRadius * Math.sin(angle);
        
        let anchor = 'middle';
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        if (cos > 0.2) anchor = 'start';
        else if (cos < -0.2) anchor = 'end';

        if (sin < -0.9) ly -= 10;
        else if (sin > 0.9) ly += 12;
        else if (sin < 0) ly -= 5;
        else ly += 5;

        return {
          x, y, lx, ly, anchor, pct, label: mod.name, color: mod.hex
        };
      });

      const polygonString = points.map(p => `${p.x},${p.y}`).join(' ');

      return {
        cx, cy, rMax, levels, axes, points, polygonString
      };
    });

    const getViewTitle = computed(() => {
      switch (activeView.value) {
        case 'instructions': return 'Instrucciones y Metodología';
        case 'general': return 'Paso 1: Datos Generales del Establecimiento';
        case 'assessment': return 'Paso 2: Evaluación de la Situación';
        case 'step3': return 'Paso 3: Evaluación del Riesgo';
        case 'step4': return 'Paso 4: Plan de Mejora';
        case 'step5': return 'Paso 5: Monitoreo y Revisión del Plan';
        case 'dashboard': return 'Resumen';
        default: return 'WASH-FIT Suite';
      }
    });

    const getActiveModuleName = computed(() => {
      const found = modulesList.find(d => d.id === activeModuleTab.value);
      return found ? found.name : 'Agua';
    });

    const getModuleAnsweredCount = (moduleId) => {
      return indicators.value.filter(i => getIndicatorModuleId(i) === moduleId && shouldShowIndicator(i) && i.score !== null).length;
    };

    const getModuleScoreAchieved = (moduleId) => {
      return indicators.value
        .filter(i => getIndicatorModuleId(i) === moduleId && shouldShowIndicator(i) && i.score !== null)
        .reduce((sum, i) => sum + i.score, 0);
    };

    const getModulePercentage = (moduleId) => {
      const answered = getModuleAnsweredCount(moduleId);
      if (answered === 0) return 0;
      const score = getModuleScoreAchieved(moduleId);
      return Math.round((score / (answered * 2)) * 100);
    };

    const navigateNextModule = () => {
      const currentIndex = modulesList.findIndex(d => d.id === activeModuleTab.value);
      const nextIndex = (currentIndex + 1) % modulesList.length;
      activeModuleTab.value = modulesList[nextIndex].id;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      triggerToast(`Navegando al módulo: ${modulesList[nextIndex].name}`, 'success');
      nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    };

    const clearCurrentModule = () => {
      const currentModuleName = getActiveModuleName.value;
      const moduleIndicators = indicators.value.filter(i => getIndicatorModuleId(i) === activeModuleTab.value);
      
      moduleIndicators.forEach(ind => {
        ind.score = null;
        ind.notes = '';
        ind.problemDesc = '';
        ind.associatedRisks = '';
        ind.severity = null;
        ind.likelihood = null;
        ind.action = '';
        ind.targetDate = '';
        ind.resources = '';
        ind.responsible = '';
        ind.cost = null;
        ind.trackingStatus = 'No Iniciado';
        ind.revisionNotes = '';
        ind.indicatorChange = 'sin_cambios';
        ind.correctiveMeasures = '';
        ind.nextReviewDate = '';
        ind.monitoringComments = '';
      });
      
      triggerToast(`Se ha eliminado todo el llenado para el Módulo de ${currentModuleName}.`, 'success');
      
      nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    };

    const getStatusColorClass = (status) => {
      if (status === 'Completado') return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
      if (status === 'En Progreso') return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
      if (status === 'Retrasado') return 'bg-red-50 text-red-800 border-red-300 font-bold';
      return 'bg-paho-card text-paho-gray-dark border-paho-grid';
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const addTeamMember = () => {
      generalInfo.value.team.push({
        id: WashCore.newId(),
        name: '',
        role: '',
        institution: '',
        responsibility: '',
        email: '',
        isEditing: true
      });
      triggerToast('Fila de integrante creada. Llene los datos y haga clic en "Confirmar".', 'success');
      nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    };

    const confirmTeamMember = (index) => {
      const member = generalInfo.value.team[index];
      if (!member.name.trim()) {
        triggerToast('El nombre del integrante es obligatorio.', 'error');
        return;
      }
      if (member.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) { triggerToast('Ingrese un correo válido o deje el campo vacío.', 'error'); return; }
      member.isEditing = false;
      triggerToast('Integrante confirmado. El borrador se guardará automáticamente.', 'success');
      nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    };

    const editTeamMember = (index) => {
      generalInfo.value.team[index].isEditing = true;
      triggerToast('Modificando registro del integrante.', 'success');
      nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    };

    const removeTeamMember = (index) => {
      const member = generalInfo.value.team[index];
      indicators.value.filter(ind => ind.responsibleId === member.id).forEach(ind => { ind.responsible = member.name; ind.responsibleId = ''; });
      generalInfo.value.team.splice(index, 1);
      triggerToast('Integrante removido del equipo.', 'error');
      nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    };

    // Lógica avanzada de visibilidad condicional según nivel y tipo de infraestructura
    const shouldShowIndicator = (ind) => {
      const currentLevel = generalInfo.value.level || '';
      const isHospital = currentLevel.includes('Segundo') || currentLevel.includes('Tercer');

      // 1. Filtrado de agua según nivel primario vs hospitalario (A_1a / A_1b)
      if ((ind.code === 'A_1a') && isHospital) return false;
      if ((ind.code === 'A_1b') && !isHospital) return false;

      // 2. Indicadores exclusivos para hospitales / pac. hospitalizados
      if (['RES_16', 'RES_17', 'EC_13', 'EC_15', 'EC_16', 'L_13', 'L_15', 'L_16', 'M_11'].includes(ind.code)) {
        if (!isHospital) return false;
      }

      // 3. Filtrado por Sistema de Saneamiento (Alcantarillado vs In Situ)
      if (ind.code === 'S_8') {
        if (generalInfo.value.sanitationSystem === 'alcantarillado') {
          return false;
        }
        return true; 
      }

      if (ind.code === 'S_9a' || ind.code === 'S_9b') {
        if (generalInfo.value.sanitationSystem === 'alcantarillado') {
          return false;
        }
        const s8 = indicators.value.find(i => i.code === 'S_8');
        const s8Evaluated = s8 && s8.score !== null;
        if (generalInfo.value.sanitationSystem === 'insitu' && s8Evaluated) {
          return generalInfo.value.selectedS9Option === ind.code;
        }
        return false; 
      }

      // 4. Filtrado condicional de aguas grises (S_13 depende de S_11)
      if (ind.code === 'S_13') {
        const s11 = indicators.value.find(i => i.code === 'S_11');
        return s11 && (s11.score === 1 || s11.score === 2);
      }

      return true;
    };

    const setIndicatorScore = (ind, score) => {
      if (ind.score === score) {
        ind.score = null;
        ind.problemDesc = '';
        ind.associatedRisks = '';
        ind.severity = null;
        ind.likelihood = null;
        ind.action = '';
        ind.targetDate = '';
        ind.resources = '';
        ind.responsible = '';
        ind.cost = null;
        ind.trackingStatus = 'No Iniciado';
        
        triggerToast(`Se desmarcó el indicador.`, 'info');
        
        nextTick(() => {
          if (window.lucide) window.lucide.createIcons();
        });
        return;
      }

      ind.score = score;

      if (ind.code === 'S_11' && score !== 1 && score !== 2) {
        const s13 = indicators.value.find(i => i.code === 'S_13');
        if (s13) {
          s13.score = null;
          s13.notes = '';
        }
      }

      if (score === 0 || score === 1) {
        if (ind.severity === undefined) ind.severity = null;
        if (ind.likelihood === undefined) ind.likelihood = null;
      }
      
      triggerToast(`Indicador marcado con éxito.`, 'success');
      
      nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    };

    const setSanitationSystem = (type) => {
      generalInfo.value.sanitationSystem = type;
      if (type === 'alcantarillado') {
        generalInfo.value.selectedS9Option = null;
        const s8 = indicators.value.find(i => i.code === 'S_8');
        const s9b = indicators.value.find(i => i.code === 'S_9b');
        const s10b = indicators.value.find(i => i.code === 'S_10b');
        if (s8) s8.score = null;
        if (s9b) s9b.score = null;
        if (s10b) s10b.score = null;
      } else if (type === 'insitu') {
        const s9a = indicators.value.find(i => i.code === 'S_9a');
        const s10a = indicators.value.find(i => i.code === 'S_10a');
        if (s9a) s9a.score = null;
        if (s10a) s10a.score = null;
      }
    };

    const getModuleTotalCount = (moduleId) => {
      return indicators.value.filter(i => getIndicatorModuleId(i) === moduleId && shouldShowIndicator(i)).length;
    };

    const triggerMockUpload = () => {
      const fileInputElement = document.getElementById('real-file-input');
      if (fileInputElement) {
        fileInputElement.click();
      }
    };
    const triggerImport = () => document.getElementById('import-file')?.click();

    const processPhotos = async files => {
      if (photoBusy.value || !files?.length) return;
      photoBusy.value = true;
      let added = 0;
      let failed = 0;
      try {
        for (const file of Array.from(files)) {
          if (generalInfo.value.photos.length >= WashCore.MAX_PHOTOS || file.size > WashCore.MAX_PHOTO_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { failed++; continue; }
          try {
            const url = await compressImage(file, 1200, 1200, 0.7);
            generalInfo.value.photos.push({ name: file.name.replace(/\.[^.]+$/, '') + '.jpg', url });
            added++;
          } catch (_) { failed++; }
        }
        triggerToast(added ? added + ' fotografía(s) cargada(s).' + (failed ? ' ' + failed + ' rechazada(s): revise formato, tamaño o límite.' : '') : 'No se cargaron fotografías. Use JPG, PNG o WebP de hasta 5 MB; máximo 20 fotos.', added ? 'success' : 'error');
      } finally { photoBusy.value = false; }
    };
    const handleFileChange = async event => { await processPhotos(event.target.files); event.target.value = ''; };
    const handlePhotoDrop = event => processPhotos(event.dataTransfer.files);

    const removePhoto = (index) => {
      generalInfo.value.photos.splice(index, 1);
      triggerToast('Evidencia fotográfica removida.', 'error');
    };

    const downloadDataset = dataset => {
      const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = WashCore.fileBaseName(dataset.generalInfo) + '.json';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const archiveBusy = ref(false);
    const archiveFailed = ref(false);
    const archiveStatus = ref('');
    const lastArchive = ref(null);
    const archiveFingerprint = dataset => JSON.stringify([dataset.generalInfo, dataset.indicators]);
    const driveCurrent = computed(() => lastArchive.value?.fingerprint === archiveFingerprint(snapshot()));
    const driveLabel = computed(() => archiveBusy.value || archiveFailed.value ? archiveStatus.value : !lastArchive.value ? 'Drive: sin copia confirmada en este navegador.' : driveCurrent.value ? 'Drive: JSON y PDF confirmados.' : 'Drive: hay cambios sin archivar.');
    const archiveTime = computed(() => lastArchive.value ? new Date(lastArchive.value.savedAt).toLocaleString('es') : '');
    onMounted(async () => {try { lastArchive.value = await store.read('lastArchive'); } catch (_) {} });
    let archiveJob = null;
    const createArchiveJob = async dataset => {
      const visibleCodes = dataset.indicators.filter(shouldShowIndicator).map(i => i.code);
      const pdfData = WashCore.clone(dataset);
      // Validar y limitar las imágenes evita bloquear el PDF con evidencias dañadas.
      for (const photo of pdfData.generalInfo.photos) {
        photo.url = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', .9));
          };
          image.onerror = () => reject(new Error('No se pudo incluir una fotografía en el PDF.'));
          image.src = photo.url;
        });
      }
      const definition = WashPdf.definition(pdfData, visibleCodes, modulesList);
      const pdf = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('No se pudo preparar el PDF a tiempo. Reintente el guardado.')), 60000);
        try { pdfMake.createPdf(definition).getBlob(blob => { clearTimeout(timer); resolve(blob); }); } catch (error) { clearTimeout(timer); reject(error); }
      });
      return {dataset, json: new Blob([JSON.stringify(dataset, null, 2)], {type: 'application/json'}), pdf};
    };
    const runArchive = async dataset => {
      if (archiveBusy.value) return false;
      archiveBusy.value = true;
      archiveFailed.value = false;
      archiveStatus.value = 'Preparando JSON y PDF…';
      try {
        if (dataset) { archiveJob = null; archiveJob = await createArchiveJob(dataset); }
        if (!archiveJob) throw new Error('No hay una evaluación pendiente. Vuelva a Exportar.');
        const result = await WashArchive.save(archiveJob, text => { archiveStatus.value = text; });
        lastArchive.value = {savedAt: result.savedAt, files: result.files, fingerprint: archiveFingerprint(archiveJob.dataset)};
        try { await store.write('lastArchive', lastArchive.value); } catch (_) { triggerToast('Archivos confirmados en Drive; no se pudo conservar el estado en este navegador.', 'error'); }
        archiveStatus.value = 'JSON y PDF guardados en Drive.';
        archiveJob = null;
        triggerToast(archiveStatus.value);
        return true;
      } catch (error) {
        archiveFailed.value = true;
        archiveStatus.value = (archiveJob?.ids?.[0] ? 'JSON guardado; PDF o confirmación pendientes. ' : 'Guardado en Drive pendiente. ') + error.message;
        triggerToast(archiveStatus.value, 'error');
        return false;
      } finally { archiveBusy.value = false; nextTick(() => window.lucide?.createIcons()); }
    };
    const retryArchive = () => runArchive(archiveJob ? null : snapshot());
    const exportData = async () => {
      if (archiveBusy.value) return;
      const dataset = snapshot();
      downloadDataset(dataset);
      await runArchive(dataset);
    };
    const importData = event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > WashCore.MAX_IMPORT_BYTES) { triggerToast('El JSON supera el límite de 40 MB.', 'error'); event.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const dataset = WashCore.normalizeDataset(JSON.parse(e.target.result), INDICATORS_DATA);
          // Validación completa antes de tocar el borrador o la base de datos.
          if (!await saveDraft(true)) throw new Error('No se pudo conservar el borrador actual. Exporte un respaldo antes de importar.');
          applyDataset(dataset);
          const saved = await saveDraft();
          triggerToast(saved ? 'Evaluación validada, importada y guardada.' : 'Importada en pantalla; falló el guardado. Exporte un respaldo.', saved ? 'success' : 'error');
        } catch (error) { triggerToast(error.message || 'Archivo JSON inválido.', 'error'); }
        finally { event.target.value = ''; }
      };
      reader.onerror = () => { triggerToast('No se pudo leer el archivo JSON.', 'error'); event.target.value = ''; };
      return reader.readAsText(file);
    };

    const switchView = (viewName) => {
      activeView.value = viewName;
      mobileMenuOpen.value = false;

      if (viewName === 'general') {
        nextTick(() => {
          if (mapInstance) {
            mapInstance.invalidateSize();
            if (Number.isFinite(generalInfo.value.latitude) && Number.isFinite(generalInfo.value.longitude)) {
              mapInstance.setView([generalInfo.value.latitude, generalInfo.value.longitude], mapInstance.getZoom());
            }
          } else {
            initMap();
          }
        });
      }

      nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    };

    const printReport = async () => {
      if (archiveBusy.value) return;
      const dataset = snapshot();
      reportPreview.value = true;
      await nextTick();
      await prepareReportMap();
      await runArchive(dataset);
      const previousTitle = document.title;
      document.title = WashCore.fileBaseName(dataset.generalInfo);
      window.addEventListener('afterprint', () => { document.title = previousTitle; }, {once: true});
      window.print();
    };
    const bulletValue = value => value ? WashCore.bulletEdit(value).value : '';
    const focusBulletField = event => { if (!event.target.value) { event.target.value = '• '; event.target.setSelectionRange(2, 2); } };
    const updateBulletField = (event, ind, field) => {
      if (event.isComposing) return;
      const el = event.target;
      const edit = WashCore.bulletEdit(el.value, el.selectionStart);
      ind[field] = WashCore.bulletHasContent(edit.value) ? edit.value : '';
      el.value = edit.value;
      nextTick(() => { el.value = edit.value; el.setSelectionRange(edit.caret, edit.caret); });
    };
    const enterBulletField = (event, ind, field) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      event.target.setRangeText('\n• ', event.target.selectionStart, event.target.selectionEnd, 'end');
      updateBulletField(event, ind, field);
    };
    const blurBulletField = event => { if (!WashCore.bulletHasContent(event.target.value)) event.target.value = ''; };
    const getResponsibleName = ind => WashCore.responsibleName(ind, generalInfo.value.team);
    const getAssessmentResult = ind => WashCore.assessmentResult(ind.score);
    const getTrackingStatus = ind => WashCore.trackingStatus(ind);
    const recordReview = ind => {
      try { WashCore.recordReview(ind, generalInfo.value.team); triggerToast('Revisión agregada al historial.'); }
      catch (error) { triggerToast(error.message, 'error'); }
    };
    const reportIndicators = computed(() => indicators.value.filter(shouldShowIndicator));
    const reportRisks = computed(() => reportIndicators.value.filter(ind => ind.score !== null));
    const reportPlans = computed(() => reportIndicators.value.filter(ind => ind.score === 0 || ind.score === 1 || ind.action || ind.history?.length));
    let reportMap = null;
    let reportMarker = null;
    let reportTilesReady = Promise.resolve();
    const prepareReportMap = async () => {
      const { latitude, longitude } = generalInfo.value;
      if (!window.L || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !document.getElementById('report-map')) return;
      if (!reportMap) {
        reportMap = L.map('report-map', { zoomControl: false }).setView([latitude, longitude], 14);
        const layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' });
        reportTilesReady = new Promise(resolve => { layer.once('load', resolve); setTimeout(resolve, 2000); });
        layer.addTo(reportMap);
        reportMarker = L.marker([latitude, longitude]).addTo(reportMap);
      } else { reportMap.setView([latitude, longitude]); reportMarker.setLatLng([latitude, longitude]); reportMap.invalidateSize(); }
      await reportTilesReady;
    };
    watch(reportPreview, async open => { await nextTick(); window.scrollTo({ top: 0 }); if (open) await prepareReportMap(); });

    let mapInstance = null;
    let markerInstance = null;
    const locationBusy = ref(false);
    const locationStatus = ref('');
    const locationFailed = ref(false);
    const locateCurrentPosition = () => {
      if (locationBusy.value) return;
      locationFailed.value = false;
      const fail = message => { locationBusy.value = false; locationFailed.value = true; locationStatus.value = message; };
      if (window.isSecureContext === false || !navigator.geolocation) {
        fail('La ubicación no está disponible en este navegador. Puedes escribir las coordenadas o usar el mapa.');
        return;
      }
      const target = generalInfo.value;
      const previous = [target.latitude, target.longitude];
      locationBusy.value = true;
      locationStatus.value = 'Obteniendo ubicación actual…';
      try {
        navigator.geolocation.getCurrentPosition(position => {
          if (generalInfo.value !== target || target.latitude !== previous[0] || target.longitude !== previous[1]) {
            fail('Los datos cambiaron mientras se obtenía la ubicación. Pulsa de nuevo para actualizarla.');
            return;
          }
          const {latitude, longitude, accuracy} = position.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            fail('No se recibieron coordenadas válidas. Inténtalo de nuevo o usa el mapa.');
            return;
          }
          target.latitude = Number(latitude.toFixed(6));
          target.longitude = Number(longitude.toFixed(6));
          onCoordinatesInput();
          locationBusy.value = false;
          locationStatus.value = 'Ubicación obtenida y coordenadas actualizadas.' + (Number.isFinite(accuracy) && accuracy >= 0 ? ' Precisión aproximada: ' + Math.round(accuracy) + ' m.' : '');
        }, error => {
          const messages = {1: 'Permiso de ubicación denegado. Puedes habilitarlo en el navegador o escribir las coordenadas.', 2: 'No se pudo determinar la ubicación. Revisa la ubicación del dispositivo o usa el mapa.', 3: 'La ubicación tardó demasiado. Inténtalo de nuevo o escribe las coordenadas.'};
          fail(messages[error.code] || 'No se pudo obtener la ubicación. Inténtalo de nuevo o usa el mapa.');
        }, {enableHighAccuracy: true, timeout: 15000, maximumAge: 0});
      } catch (_) { fail('No se pudo solicitar la ubicación. Puedes escribir las coordenadas o usar el mapa.'); }
    };

    const initMap = () => {
      if (!window.L) return;

      nextTick(() => {
        const mapDom = document.getElementById('map-container');
        if (!mapDom) return;

        if (mapInstance) {
          mapInstance.invalidateSize();
          return;
        }

        const latInit = generalInfo.value.latitude ?? -12.1485;
        const lngInit = generalInfo.value.longitude ?? -76.9841;

        mapInstance = L.map('map-container').setView([latInit, lngInit], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance);

        const createMarker = (lat, lng) => {
          markerInstance = L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
          markerInstance.on('dragend', () => { const pos = markerInstance.getLatLng(); updateCoordinates(pos.lat, pos.lng); });
        };
        if (Number.isFinite(generalInfo.value.latitude) && Number.isFinite(generalInfo.value.longitude)) createMarker(latInit, lngInit);

        const updateCoordinates = (lat, lng) => {
          generalInfo.value.latitude = parseFloat(lat.toFixed(6));
          generalInfo.value.longitude = parseFloat(lng.toFixed(6));
        };

        mapInstance.on('click', (e) => {
          if (markerInstance) markerInstance.setLatLng(e.latlng);
          else createMarker(e.latlng.lat, e.latlng.lng);
          updateCoordinates(e.latlng.lat, e.latlng.lng);
        });
      });
    };

    const onCoordinatesInput = () => {
      const lat = generalInfo.value.latitude;
      const lng = generalInfo.value.longitude;
      if (lat !== null && lat !== '' && (!Number.isFinite(lat) || lat < -90 || lat > 90) || lng !== null && lng !== '' && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) generalInfo.value.latitude = null;
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) generalInfo.value.longitude = null;
        triggerToast('Latitud: −90 a 90. Longitud: −180 a 180.', 'error'); return;
      }
      if (Number.isFinite(lat) && Number.isFinite(lng) && mapInstance) {
        if (markerInstance) markerInstance.setLatLng([lat, lng]);
        else {
          markerInstance = L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
          markerInstance.on('dragend', () => { const pos = markerInstance.getLatLng(); generalInfo.value.latitude = Number(pos.lat.toFixed(6)); generalInfo.value.longitude = Number(pos.lng.toFixed(6)); });
        }
        mapInstance.setView([lat, lng], mapInstance.getZoom());
      } else if (markerInstance) { markerInstance.remove(); markerInstance = null; }
    };
    const handlePhotoKeys = event => {
      if (event.key === 'Escape') { event.preventDefault(); closePhotoModal(); }
      if (event.key === 'Tab') {
        const buttons = [...document.querySelectorAll('#photo-dialog button')];
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
      }
    };
    onMounted(async () => {
      if (window.lucide) window.lucide.createIcons();
      window.addEventListener('online', () => { isOnline.value = true; });
      window.addEventListener('offline', () => { isOnline.value = false; });
      window.addEventListener('resize', () => { isMobile.value = window.innerWidth < 1024; });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && !loadingDraft.value && revision !== persistedRevision) saveDraft(); });
      window.addEventListener('beforeunload', event => { if (!loadingDraft.value && revision !== persistedRevision) { event.preventDefault(); event.returnValue = ''; } });
      window.addEventListener('afterprint', () => { reportPreview.value = false; });
      try {
        const draft = await store.read();
        if (draft) { applyDataset(WashCore.normalizeDataset(draft, INDICATORS_DATA)); savedAt.value = draft.savedAt || ''; }
        hasBackup.value = Boolean(await store.read('backup'));
        saveState.value = 'saved';
      } catch (error) { saveState.value = 'error'; triggerToast('No se pudo recuperar el borrador. ' + error.message, 'error'); }
      finally { loadingDraft.value = false; }
      if (activeView.value === 'general') initMap();
      if ('serviceWorker' in navigator) {
        try {
          serviceRegistration = await navigator.serviceWorker.register('sw.js');
          updateAvailable.value = Boolean(serviceRegistration.waiting);
          serviceRegistration.addEventListener('updatefound', () => {
            const installing = serviceRegistration.installing;
            installing?.addEventListener('statechange', () => { if (installing.state === 'installed' && navigator.serviceWorker.controller) updateAvailable.value = true; });
          });
          const registration = await navigator.serviceWorker.ready;
          const worker = registration.active;
          if (worker) {
            const channel = new MessageChannel();
            channel.port1.onmessage = event => { offlineReady.value = event.data === 'offline-ready'; };
            worker.postMessage('offline-status', [channel.port2]);
          }
        } catch (_) { offlineReady.value = false; }
      }
    });
    const facilityValuation = computed(() => WashCore.valuation(answeredCount.value, totalVisibleIndicators.value, overallCompliance.value));

    return {
      loadingDraft, saveState, savedAt, saveLabel, hasBackup, isOnline, offlineReady, photoBusy, isMobile, updateAvailable, updateApplication,
      newEvaluation, restoreBackup, saveDraft, handlePhotoDrop, handlePhotoKeys,
      populationWarning, reportPreview, reportIndicators, reportRisks, reportPlans,
      getResponsibleName, getAssessmentResult, getTrackingStatus, recordReview, bulletValue, focusBulletField, updateBulletField, enterBulletField, blurBulletField,
      activeView,
      activeModuleTab,
      mobileMenuOpen,
      sidebarCollapsed,
      filterOnlyGaps,
      sortRiskOrder, countries,
      toggleRiskSort,
      severityOptions,
      likelihoodOptions,
      calculateRiskScore,
      getRiskColorClass,
      getRiskLabel,
      getRiskMeaning,
      toast,
      modulesList,
      levelOptions,
      generalInfo,
      indicators,
      answeredCount,
      totalVisibleIndicators,
      progressPercentage,
      totalGaps,
      totalScoreAchieved,
      overallCompliance,
      getFilteredIndicatorsByModule,
      getActiveModuleProgressPercentage,
      getSortedGaps,
      jmpCalculatedStatus,
      radarChartData,
      getViewTitle,
      getActiveModuleName,
      setIndicatorScore,
      getModuleTotalCount,
      getModuleAnsweredCount,
      getModuleScoreAchieved,
      getModulePercentage,
      navigateNextModule,
      addTeamMember,
      confirmTeamMember,
      editTeamMember,
      removeTeamMember,
      triggerMockUpload,
      triggerImport,
      handleFileChange,
      removePhoto,
      exportData,
      archiveBusy, archiveFailed, archiveStatus, retryArchive, lastArchive, driveLabel, archiveTime,
      importData,
      switchView,
      printReport,
      clearCurrentModule,
      onCoordinatesInput,
      locateCurrentPosition, locationBusy, locationStatus, locationFailed,
      trackingSummary,
      planProgressPercentage,
      getStatusColorClass,
      formatDate,
      isPopFocused,
      updatePopulation,
      focusedAgeGroup,
      updateAgeGroup,
      focusedCostId,
      formatThousands,
      updateCost,
      shouldShowIndicator,
      setSanitationSystem,
      facilityValuation,
      isPrintingAll,

      // Estado y métodos expuestos para la ventana modal (Lightbox)
      selectedPhoto,
      openPhotoModal,
      closePhotoModal
    };
  }
}).mount('#app');
