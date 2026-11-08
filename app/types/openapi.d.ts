export interface paths {
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Аутентификация пользователя в браузере (Nuxt 4 SPA) */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Завершение сессии пользователя */
        post: operations["logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Профиль текущего пользователя и членство в школах */
        get: operations["getCurrentUser"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tenant/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Получение контекста активной школы пользователя */
        get: operations["getCurrentTenant"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Проверка статуса системного доступа */
        get: operations["getSystemStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/calendar-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Получение каталога событий с фильтрацией */
        get: operations["listCalendarEvents"];
        put?: never;
        /** Создание события календаря (для куратора или школьного админа) */
        post: operations["createCalendarEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/calendar-events/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Детальная информация о событии календаря с источниками и evidence */
        get: operations["getCalendarEvent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/schools/{schoolId}/traditions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Список традиций конкретной школы */
        get: operations["listSchoolTraditions"];
        put?: never;
        /** Создание новой школьной традиции */
        post: operations["createSchoolTradition"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/traditions/{id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Создание новой ежегодной версии школьной традиции */
        post: operations["createTraditionVersion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenario-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Сохранение параметров запроса в конструкторе мероприятий */
        post: operations["createScenarioRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenario-requests/{id}/generate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Запуск асинхронной генерации сценария с помощью LLM */
        post: operations["triggerScenarioGeneration"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/generation-runs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Опрос статуса выполнения задачи генерации */
        get: operations["getGenerationRunStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenarios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Список сценариев школы текущего пользователя */
        get: operations["listScenarios"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenarios/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Получение сценария с актуальной ревизией */
        get: operations["getScenario"];
        put?: never;
        post?: never;
        /** Безопасное soft-delete удаление сценария (блокируется при наличии sign-off) */
        delete: operations["deleteScenario"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenarios/{id}/revisions/{version}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Получить детальную информацию о конкретной ревизии сценария */
        get: operations["getScenarioRevision"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Частичное редактирование сценария (создание новой неизменяемой ревизии N+1) */
        patch: operations["updateScenarioRevision"];
        trace?: never;
    };
    "/scenarios/{id}/revisions/{version}/verifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Результаты автоматической проверки ревизии (P0 и P1) */
        get: operations["getRevisionVerifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenarios/{id}/revisions/{version}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Принудительный перезапуск модерации ревизии */
        post: operations["retriggerVerification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenarios/{id}/revisions/{version}/signoff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Ручное подтверждение сценария педагогом */
        post: operations["teacherSignoff"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenarios/{id}/revisions/{version}/exports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** История сформированных экспортов ревизии сценария */
        get: operations["listRevisionExports"];
        put?: never;
        /** Запуск генерации экспортного документа (PDF, DOCX, PPTX, Print Pack) */
        post: operations["requestExport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/export-jobs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Проверка статуса сборки экспортного документа */
        get: operations["getExportJobStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/export-jobs/{id}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Скачивание скомпилированного файла */
        get: operations["downloadExportArtifact"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Системный healthcheck сервиса и инфраструктурных зависимостей */
        get: operations["checkHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenario-requests/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Получение параметров запроса на сценарий и снимка контекста */
        get: operations["getScenarioRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/catalog/review-queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Очередь первоисточников и утверждений для экспертной рецензии */
        get: operations["getCatalogReviewQueue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/event-sources/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Детальная карточка первоисточника с историей рецензий и привязанными утверждениями */
        get: operations["getEventSource"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Редактирование библиографических сведений первоисточника */
        patch: operations["updateEventSource"];
        trace?: never;
    };
    "/event-sources/{id}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Полный хронологический журнал экспертных рецензий первоисточника */
        get: operations["listEventSourceReviews"];
        put?: never;
        /** Создание экспертной рецензии на первоисточник куратором или администратором */
        post: operations["createEventSourceReview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cultural-claims/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Карточка культурного утверждения с привязанными свидетельствами первоисточников */
        get: operations["getCulturalClaim"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cultural-claims/{id}/evidence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Привязка или верификация свидетельства первоисточника для утверждения */
        post: operations["attachCulturalClaimEvidence"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cultural-claims/{id}/evidence/{sourceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Отвязка свидетельства первоисточника от культурного утверждения */
        delete: operations["detachCulturalClaimEvidence"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/schools/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Профиль образовательной организации со сводной статистикой */
        get: operations["getSchoolProfile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Обновление сведений и настроек образовательной организации */
        patch: operations["updateSchoolProfile"];
        trace?: never;
    };
    "/dashboard/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Агрегированная сводка главной страницы для активной школы */
        get: operations["getDashboardSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/traditions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Детальная карточка школьной традиции со всеми годовыми версиями */
        get: operations["getTradition"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Редактирование метаданных традиции (исторические версии неизменны) */
        patch: operations["updateTradition"];
        trace?: never;
    };
    "/traditions/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Архивирование школьной традиции */
        post: operations["archiveTradition"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenarios/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Архивирование сценария с сохранением всех ревизий и допусков */
        post: operations["archiveScenario"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenarios/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Восстановление архивированного сценария в рабочий реестр */
        post: operations["restoreScenario"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenario-comparisons": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Список сессий A/B-сравнений сценариев текущей школы */
        get: operations["listScenarioComparisons"];
        put?: never;
        /**
         * Создание новой сессии A/B-сравнения сценариев
         * @description Mock returns completed synchronously. LiteLLM returns 201 pending: poll GET /scenario-comparisons/{id}. Failed comparisons are terminal; paid requests are never automatically replayed. Optional UUID Idempotency-Key replays within user and school scope; conflicting reuse returns 409.
         */
        post: operations["createScenarioComparison"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenario-comparisons/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Получение статуса и деталей сессии A/B-сравнения */
        get: operations["getScenarioComparison"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenario-comparisons/{id}/variants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Получение структурированных сравниваемых вариантов A и B */
        get: operations["getScenarioComparisonVariants"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scenario-comparisons/{id}/selection": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Фиксация выбора педагога между вариантами A и B */
        post: operations["selectScenarioComparisonVariant"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pilot/participants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Список анонимизированных участников пилотного исследования */
        get: operations["listPilotParticipants"];
        put?: never;
        /** Создание приглашения для участника пилотного исследования */
        post: operations["createPilotParticipant"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pilot/participants/{id}/reissue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Повторный выпуск одноразового пригласительного токена */
        post: operations["reissuePilotParticipantToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pilot/participants/{id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Отзыв приглашения участника пилотного исследования */
        post: operations["revokePilotParticipantToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pilot/responses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Отправка анкеты пилота участником по одноразовому пригласительному токену */
        post: operations["submitPilotResponse"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pilot/responses/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Просмотр деталей анкеты пилотного исследования */
        get: operations["getPilotResponse"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pilot/responses/{id}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Effective expert finding and immutable version history */
        get: operations["getPilotReviewHistory"];
        put?: never;
        /** Внесение экспертного заключения о культурных ошибках сценария */
        post: operations["submitPilotReviewFinding"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pilot/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Сводные количественные метрики пилота 20 педагогов */
        get: operations["getPilotSummaryMetrics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pilot/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Экспорт агрегированных данных пилотного исследования */
        get: operations["exportPilotMetrics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ErrorResponse: {
            error: {
                code: string;
                message: string;
                details: {
                    field: string;
                    message: string;
                }[];
                trace_id: string;
            };
        };
        LoginResponse: {
            data: {
                user: {
                    /** Format: uuid */
                    id: string;
                    name: string;
                    email: string;
                    /** @enum {string} */
                    system_role: "none" | "catalog_curator" | "system_admin";
                };
                schools: {
                    /** Format: uuid */
                    school_id: string;
                    name: string;
                    /** @enum {string} */
                    role: "teacher" | "school_admin";
                    is_default: boolean;
                }[];
            };
        };
        UserEnvelope: {
            data: {
                user: {
                    /** Format: uuid */
                    id: string;
                    name: string;
                    email: string;
                    /** @enum {string} */
                    system_role: "none" | "catalog_curator" | "system_admin";
                };
                schools: {
                    /** Format: uuid */
                    school_id: string;
                    name: string;
                    /** @enum {string} */
                    role: "teacher" | "school_admin";
                    is_default: boolean;
                }[];
            };
        };
        CreateCalendarEventRequest: {
            title: string;
            /** @enum {string} */
            event_type: "federal" | "regional" | "cultural_traditional" | "school_custom";
            region_code?: string | null;
            /** @enum {string} */
            date_type: "fixed_annual" | "floating_rule" | "single_occurrence";
            fixed_month?: number | null;
            fixed_day?: number | null;
            description: string;
            target_age_groups: ("primary_1_4" | "basic_5_9" | "senior_10_11")[];
            recommended_value_directions: ("family" | "mutual_aid" | "historical_memory" | "labor_and_creation" | "cultural_diversity" | "civic_responsibility")[];
        };
        CalendarEventListResponse: {
            data: components["schemas"]["CalendarEventSummary"][];
            meta: components["schemas"]["PaginationMeta"];
        };
        CalendarEventSummary: {
            /** Format: uuid */
            id: string;
            title: string;
            event_type: string;
            region_code?: string | null;
            description: string;
            /** @enum {string} */
            date_type?: "fixed_annual" | "floating_rule" | "single_occurrence";
            fixed_month?: number | null;
            fixed_day?: number | null;
            occurrences?: components["schemas"]["CalendarOccurrence"][];
        };
        CalendarEventEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                title: string;
                event_type: string;
                region_code?: string | null;
                description: string;
                sources: {
                    /** Format: uuid */
                    id: string;
                    title: string;
                    url?: string | null;
                }[];
                cultural_claims: {
                    /** Format: uuid */
                    id: string;
                    claim_text: string;
                    culture_name: string;
                    evidence_records: {
                        /** Format: uuid */
                        event_source_id: string;
                        citation_locator: string;
                        citation_excerpt?: string | null;
                        verification_status: string;
                        notes?: string | null;
                    }[];
                }[];
                /** @enum {string} */
                date_type?: "fixed_annual" | "floating_rule" | "single_occurrence";
                fixed_month?: number | null;
                fixed_day?: number | null;
                occurrences?: components["schemas"]["CalendarOccurrence"][];
            };
        };
        PaginationMeta: {
            current_page: number;
            last_page: number;
            per_page: number;
            total: number;
        };
        TraditionListResponse: {
            data: {
                /** Format: uuid */
                id: string;
                title: string;
                description: string;
                established_year?: number | null;
                active_version?: {
                    /** Format: uuid */
                    id?: string;
                    academic_year?: string;
                    notes?: string | null;
                    /** Format: date-time */
                    created_at?: string;
                } | null;
                versions?: {
                    /** Format: uuid */
                    id?: string;
                    academic_year?: string;
                    notes?: string | null;
                    /** Format: date-time */
                    created_at?: string;
                }[];
            }[];
        };
        CreateTraditionRequest: {
            title: string;
            description: string;
            established_year?: number | null;
        };
        CreateTraditionVersionRequest: {
            academic_year: string;
            parameters_snapshot: Record<string, never>;
            notes?: string | null;
        };
        /** @description Строго один повод: calendar_event_id, tradition_version_id или custom_event_title. Поле school_id передавать запрещено (ошибка 422). */
        CreateScenarioRequestDTO: {
            /** Format: uuid */
            calendar_event_id?: string | null;
            /** Format: uuid */
            tradition_version_id?: string | null;
            custom_event_title?: string | null;
            /** @enum {string} */
            scale: "class_level" | "all_school" | "family_community";
            /** @enum {string} */
            format_type: "class_hour" | "quest" | "quiz" | "workshop" | "festival" | "roundtable";
            target_grades: number[];
            participants_count: number;
            duration_minutes: number;
            /** @enum {string} */
            value_direction: "family" | "mutual_aid" | "historical_memory" | "labor_and_creation" | "cultural_diversity" | "civic_responsibility";
            family_involvement: boolean;
            available_resources?: string[];
            pedagogical_constraints?: string | null;
        };
        ScenarioRequestEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** Format: uuid */
                school_id: string;
                /** Format: uuid */
                user_id: string;
                /** Format: uuid */
                calendar_event_id?: string | null;
                /** Format: uuid */
                tradition_version_id?: string | null;
                custom_event_title?: string | null;
                scale: string;
                format_type: string;
                target_grades: number[];
                participants_count: number;
                duration_minutes: number;
                value_direction: string;
                family_involvement?: boolean;
                available_resources?: string[];
                pedagogical_constraints?: string | null;
                context_snapshot: Record<string, never>;
                /** Format: date-time */
                created_at?: string;
                /** Format: date-time */
                updated_at?: string;
            };
        };
        GenerationAcceptedResponse: {
            data: {
                /** Format: uuid */
                generation_run_id: string;
                /** @example queued */
                status: string;
                /** @example 15 */
                estimated_wait_seconds: number;
                poll_url: string;
            };
        };
        GenerationRunEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** @enum {string} */
                status: "queued" | "running" | "completed" | "failed" | "timed_out";
                /** Format: uuid */
                scenario_id?: string | null;
                /** Format: uuid */
                revision_id?: string | null;
                error_message?: string | null;
            };
        };
        ScenarioListResponse: {
            data: {
                /** Format: uuid */
                id: string;
                title: string;
                /** @enum {string} */
                status: "draft" | "completed" | "archived";
                is_archived: boolean;
                /** Format: uuid */
                current_revision_id: string | null;
                optimistic_lock_version: number;
                /** Format: date-time */
                created_at: string;
                /** Format: date-time */
                updated_at: string;
                moderation_status: string;
                current_revision?: {
                    /** Format: uuid */
                    id?: string;
                    version_number?: number;
                    change_description?: string | null;
                    moderation_status?: string;
                } | null;
            }[];
            meta: components["schemas"]["PaginationMeta"];
        };
        ScenarioEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** Format: uuid */
                school_id: string;
                /** Format: uuid */
                scenario_request_id: string;
                title: string;
                /** @enum {string} */
                status: "draft" | "completed" | "archived";
                is_archived: boolean;
                /** Format: uuid */
                current_revision_id: string | null;
                optimistic_lock_version: number;
                moderation_status: string;
                /** Format: date-time */
                created_at: string;
                /** Format: date-time */
                updated_at: string;
                current_revision: {
                    /** Format: uuid */
                    id?: string;
                    version_number?: number;
                    change_description?: string | null;
                    moderation_status?: string;
                    concept?: string;
                    pedagogical_goal?: string;
                    content_payload?: Record<string, never>;
                    /** Format: date-time */
                    created_at?: string;
                    moderation_state?: {
                        status?: string;
                        p0_violations_count?: number;
                        p1_violations_count?: number;
                        moderator_notes?: string | null;
                        /** Format: date-time */
                        checked_at?: string | null;
                    } | null;
                    signoff?: {
                        /** Format: uuid */
                        id?: string;
                        is_confirmed?: boolean;
                        checklist_confirmed?: Record<string, never>;
                        teacher_notes?: string | null;
                        /** Format: date-time */
                        confirmed_at?: string | null;
                        user?: {
                            /** Format: uuid */
                            id?: string;
                            name?: string;
                        } | null;
                    } | null;
                    stages?: Record<string, never>[];
                    materials?: Record<string, never>[];
                } | null;
                generation?: {
                    /** Format: uuid */
                    id?: string;
                    provider_name?: string;
                    model_identifier?: string;
                    prompt_version?: string;
                    schema_version?: string;
                    latency_ms?: number | null;
                    prompt_tokens?: number | null;
                    completion_tokens?: number | null;
                } | null;
                quality_review?: components["schemas"]["QualityReview"];
            };
        };
        ScenarioRevisionEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** Format: uuid */
                scenario_id: string;
                version_number: number;
                is_current: boolean;
                concept: string;
                pedagogical_goal: string;
                total_duration_minutes: number;
                moderation_status: string;
                moderation_state?: {
                    status?: string;
                    p0_violations_count?: number;
                    p1_violations_count?: number;
                    moderator_notes?: string | null;
                    /** Format: date-time */
                    checked_at?: string | null;
                } | null;
                signoff?: {
                    /** Format: uuid */
                    id?: string;
                    is_confirmed?: boolean;
                    checklist_confirmed?: Record<string, never>;
                    teacher_notes?: string | null;
                    /** Format: date-time */
                    confirmed_at?: string | null;
                    user?: {
                        /** Format: uuid */
                        id?: string;
                        name?: string;
                    } | null;
                } | null;
                /** Format: date-time */
                created_at: string;
                stages: Record<string, never>[];
                materials: Record<string, never>[];
                content_payload: Record<string, never>;
                quality_review?: components["schemas"]["QualityReview"];
            };
        };
        /** @description Все поля опциональны для поддержки частичного обновления (Partial Edit). Непереданные поля наследуются сервером из текущей ревизии. */
        UpdateScenarioRevisionRequest: {
            concept?: string;
            pedagogical_goal?: string;
            pedagogical_tasks?: Record<string, never>;
            stages?: Record<string, never>[];
            materials?: Record<string, never>;
        };
        VerificationRunEnvelope: {
            data: {
                /** Format: uuid */
                verification_run_id: string;
                /** @enum {string} */
                status: "running" | "passed" | "passed_with_warnings" | "blocked" | "failed_engine";
                p0_violations_count: number;
                p1_violations_count: number;
                findings: {
                    /** Format: uuid */
                    id: string;
                    /** @enum {string} */
                    severity: "P0" | "P1";
                    rule_code: string;
                    target_path: string;
                    message: string;
                    suggested_fix?: string | null;
                }[];
            };
        };
        TeacherSignoffRequest: {
            checklist_confirmed: {
                /**
                 * @description Строго true. Без личного подтверждения безопасности sign-off невозможен.
                 * @enum {boolean}
                 */
                safety_checked: true;
                /**
                 * @description Строго true. Подтверждение реалистичности хронометража.
                 * @enum {boolean}
                 */
                timing_fit: true;
                /**
                 * @description Строго true. Подтверждение отсутствия стереотипов.
                 * @enum {boolean}
                 */
                cultural_context_approved: true;
            };
            teacher_notes?: string | null;
        };
        ExportJobEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** @enum {string} */
                status: "queued" | "processing" | "ready" | "failed";
                download_url?: string | null;
                file_name?: string | null;
                file_size_bytes?: number | null;
                error_message?: string | null;
                /** Format: date-time */
                created_at?: string | null;
                /** Format: date-time */
                completed_at?: string | null;
            };
        };
        ExportJobListEnvelope: {
            data: components["schemas"]["ExportJobHistoryItem"][];
        };
        ExportJobHistoryItem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            revision_id?: string;
            /** @enum {string} */
            format: "pdf" | "docx" | "pptx" | "print_pack_pdf";
            /** @enum {string} */
            status: "queued" | "processing" | "ready" | "failed";
            provenance_fingerprint?: string | null;
            /** @description Флаг доступности скачивания с учетом актуальности доказательной базы (Provenance Gate) */
            is_downloadable: boolean;
            download_url: string;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            completed_at?: string | null;
            artifact?: {
                /** Format: uuid */
                id?: string;
                file_name?: string;
                file_size_bytes?: number;
                mime_type?: string;
                sha256_hash?: string;
                /** Format: date-time */
                expires_at?: string | null;
            } | null;
        };
        CreatePilotResponseDTO: {
            invite_token: string;
            /** Format: uuid */
            scenario_id: string;
            prep_time_baseline_minutes: number;
            prep_time_ai_minutes: number;
            personalization_selected: boolean;
            manual_edit_percentage: number;
            cultural_context_used: boolean;
            cultural_usefulness_score: number;
            feedback_text?: string | null;
        };
        PilotMetricsResponse: {
            data: {
                /** @enum {string} */
                status: "no_data" | "active_pilot" | "completed";
                total_participants: number;
                /** @description Общее количество отправленных анкет педагогов */
                submitted_responses_count: number;
                /** @description Количество проверенных экспертами анкет */
                audited_responses_count: number;
                /** @description Псевдоним для audited_responses_count для обратной совместимости */
                audited_reviews_count: number;
                /** @description Количество анкет, ожидающих экспертной оценки */
                pending_expert_reviews_count: number;
                /** @description Доля проверенных анкет в процентах от общего объема (0.00-100.00%) */
                expert_review_coverage_percent: number | null;
                median_relative_time_saving_percent: number | null;
                /** @description Субъективный выбор персонализации по результатам анкетного опроса */
                personalization_choice_percent: number | null;
                /** @description Субъективный выбор персонализации педагогом в опросе (в отличие от ScenarioComparison::selected_variant) */
                self_reported_personalization_choice_percent: number | null;
                manual_edit_under_20_percent_ratio: number | null;
                cultural_context_usage_percent: number | null;
                average_cultural_usefulness_score: number | null;
                /** @description Количество критических этнокультурных ошибок среди проверенных анкет (null при отсутствии проведенных экспертиз) */
                critical_cultural_errors_count: number | null;
                sample_size: number;
                target_sample_size: number;
                /** @description Завершен ли сбор анкет педагогов (N >= 20) */
                is_survey_completed: boolean;
                /** @description Завершена ли экспертная оценка (N >= 20 и проверено 100% анкет) */
                is_expert_evaluation_completed: boolean;
                /** @description Завершен ли пилот в целом (опрос и экспертиза завершены, критических ошибок 0) */
                is_pilot_completed: boolean;
                criteria_progress: {
                    time_saving_ge_50?: boolean;
                    personalization_ge_70?: boolean;
                    manual_edit_under_20_ge_70?: boolean;
                    cultural_usage_ge_60?: boolean;
                    cultural_usefulness_ge_4?: boolean;
                    zero_critical_cultural_errors?: boolean;
                };
                criteria_status: {
                    time_saving_ge_50?: string;
                    personalization_ge_70?: string;
                    manual_edit_under_20_ge_70?: string;
                    cultural_usage_ge_60?: string;
                    cultural_usefulness_ge_4?: string;
                    zero_critical_cultural_errors?: string;
                };
                sample_breakdown: {
                    personalization: {
                        selected: number;
                        total: number;
                    };
                    manual_edits: {
                        under_20_percent: number;
                        total: number;
                    };
                    cultural_context: {
                        used: number;
                        rated_count: number;
                        total: number;
                    };
                    expert_reviews: {
                        audited: number;
                        pending: number;
                        coverage_percent: number | null;
                        critical_errors: number | null;
                    };
                };
            };
        };
        TenantCurrentEnvelope: {
            data: {
                /** Format: uuid */
                school_id: string;
                school_name: string;
                /** @enum {string} */
                role: "teacher" | "school_admin";
            };
        };
        SystemStatusEnvelope: {
            data: {
                system_status: string;
                /** @enum {string} */
                system_role: "system_admin" | "catalog_curator";
            };
        };
        ReviewQueueResponse: {
            data: components["schemas"]["ReviewQueueItem"][];
            meta: components["schemas"]["PaginationMeta"];
        };
        ReviewQueueItem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            calendar_event_id: string;
            calendar_event?: {
                /** Format: uuid */
                id?: string;
                title?: string;
                event_type?: string;
                region_code?: string | null;
                status?: string;
            } | null;
            source_type: string;
            title: string;
            author?: string | null;
            url?: string | null;
            doi_or_isbn?: string | null;
            claims_count?: number;
            /** @enum {string} */
            status: "pending" | "approved" | "rejected" | "requires_amendment";
            latest_review?: {
                /** Format: uuid */
                id?: string;
                decision?: string;
                comments?: string;
                reviewer?: Record<string, never> | null;
                /** Format: date-time */
                reviewed_at?: string;
            } | null;
            verified_by?: Record<string, never> | null;
            verification_date?: string | null;
            /** Format: date-time */
            created_at: string;
        };
        EventSourceEnvelope: {
            data: components["schemas"]["EventSourceDetail"];
        };
        EventSourceDetail: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            calendar_event_id: string;
            calendar_event?: Record<string, never> | null;
            source_type: string;
            title: string;
            author?: string | null;
            url?: string | null;
            doi_or_isbn?: string | null;
            verified_by?: Record<string, never> | null;
            verification_date?: string | null;
            latest_review?: Record<string, never> | null;
            reviews_count?: number;
            claims_count?: number;
            claims?: Record<string, never>[];
            /** Format: date-time */
            created_at: string;
        };
        SourceReviewListResponse: {
            data: components["schemas"]["SourceReviewItem"][];
        };
        SourceReviewEnvelope: {
            data: components["schemas"]["SourceReviewItem"];
        };
        SourceReviewItem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            event_source_id: string;
            /** @enum {string} */
            decision: "approved" | "rejected" | "requires_amendment";
            comments: string;
            reviewer: {
                /** Format: uuid */
                id: string;
                name: string;
                system_role: string;
                curator_scope?: string | null;
            };
            /** Format: date-time */
            reviewed_at: string;
        };
        CulturalClaimEnvelope: {
            data: components["schemas"]["CulturalClaimDetail"];
        };
        CulturalClaimDetail: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            calendar_event_id: string;
            calendar_event?: Record<string, never> | null;
            claim_text: string;
            culture_name: string;
            provenance_notes?: string | null;
            evidence_records: {
                /** Format: uuid */
                id: string;
                /** Format: uuid */
                cultural_claim_id?: string;
                /** Format: uuid */
                event_source_id: string;
                source?: {
                    /** Format: uuid */
                    id: string;
                    title: string;
                    author: string | null;
                    source_type: string;
                } | null;
                citation_locator: string;
                citation_excerpt: string;
                verification_status: string;
                effective_status: string;
                verified_by?: Record<string, never> | null;
                /** Format: date-time */
                verified_at?: string | null;
                applicable_academic_year?: string | null;
                notes?: string | null;
                /** Format: date-time */
                created_at?: string;
            }[];
            evidence_audit_events?: components["schemas"]["CulturalClaimEvidenceAuditEvent"][];
            /** Format: date-time */
            created_at: string;
        };
        CulturalClaimEvidenceAuditEvent: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            cultural_claim_source_id?: string | null;
            /** Format: uuid */
            event_source_id?: string;
            /** @enum {string} */
            action: "attached" | "detached" | "reattached" | "reverified" | "invalidated_by_source_amendment";
            /** Format: uuid */
            actor_user_id?: string | null;
            actor?: Record<string, never> | null;
            previous_verification_status?: string | null;
            new_verification_status?: string | null;
            citation_locator?: string | null;
            citation_excerpt?: string | null;
            reason?: string | null;
            /** Format: date-time */
            created_at: string;
        };
        CulturalClaimEvidenceEnvelope: {
            data: components["schemas"]["CulturalClaimEvidenceItem"];
        };
        CulturalClaimEvidenceItem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            cultural_claim_id: string;
            /** Format: uuid */
            event_source_id: string;
            source?: {
                /** Format: uuid */
                id: string;
                title: string;
                author: string | null;
                source_type: string;
            } | null;
            citation_locator: string;
            citation_excerpt: string;
            verification_status: string;
            effective_status: string;
            verified_by?: Record<string, never> | null;
            /** Format: date-time */
            verified_at?: string | null;
            applicable_academic_year?: string | null;
            notes?: string | null;
            /** Format: date-time */
            created_at?: string;
        };
        SchoolProfileEnvelope: {
            data: components["schemas"]["SchoolProfileDetail"];
        };
        SchoolProfileDetail: {
            /** Format: uuid */
            id: string;
            name: string;
            short_name?: string | null;
            region_code: string;
            city: string;
            inn?: string | null;
            settings?: components["schemas"]["SchoolSettings"] | unknown[];
            traditions_count: number;
            active_teachers_count: number;
            /** Format: date-time */
            created_at?: string | null;
            /** Format: date-time */
            updated_at?: string | null;
        };
        DashboardSummaryEnvelope: {
            data: components["schemas"]["DashboardSummaryDetail"];
        };
        DashboardSummaryDetail: {
            school: {
                /** Format: uuid */
                id: string;
                name: string;
                short_name?: string | null;
                region_code: string;
                city: string;
            };
            upcoming_events: Record<string, never>[];
            recent_scenarios: Record<string, never>[];
            counts: {
                total_scenarios: number;
                draft_scenarios: number;
                completed_scenarios: number;
                archived_scenarios: number;
                traditions_count: number;
            };
        };
        TraditionDetailEnvelope: {
            data: components["schemas"]["TraditionDetail"];
        };
        TraditionDetail: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            school_id: string;
            title: string;
            description: string;
            established_year?: number | null;
            is_archived: boolean;
            /** Format: uuid */
            created_by_user_id?: string | null;
            /** Format: date-time */
            created_at?: string | null;
            /** Format: date-time */
            updated_at?: string | null;
            active_version?: Record<string, never> | null;
            versions: Record<string, never>[];
        };
        TraditionEnvelope: {
            data: components["schemas"]["TraditionSummary"];
        };
        TraditionSummary: {
            /** Format: uuid */
            id: string;
            title: string;
            description?: string | null;
            established_year?: number | null;
            is_archived: boolean;
            /** Format: date-time */
            updated_at?: string | null;
        };
        ScenarioLifecycleEnvelope: {
            data: components["schemas"]["ScenarioLifecycleSummary"];
        };
        ScenarioLifecycleSummary: {
            /** Format: uuid */
            id: string;
            title: string;
            status: string;
            is_archived: boolean;
            /** Format: date-time */
            updated_at?: string | null;
        };
        CreateScenarioComparisonDTO: {
            /** Format: uuid */
            scenario_request_id: string;
            /** @enum {string} */
            comparison_type: "universal_vs_personalized" | "cultural_context";
        };
        SelectScenarioComparisonVariantDTO: {
            /** @enum {string} */
            selected_variant: "A" | "B";
            selection_reason: string;
            cultural_usefulness_rating?: number | null;
        };
        ScenarioComparisonItem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            school_id?: string;
            comparison_type: string;
            status: string;
            selected_variant?: string | null;
            selection_reason?: string | null;
            /** Format: date-time */
            selection_recorded_at?: string | null;
            cultural_usefulness_rating?: number | null;
            /** Format: date-time */
            created_at: string;
        };
        ScenarioComparisonEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                comparison_type: string;
                status: string;
                selected_variant?: string | null;
                selection_reason?: string | null;
                differences_summary?: Record<string, never>;
                variants?: Record<string, never>[];
                quality_review?: {
                    A?: components["schemas"]["QualityReview"];
                    B?: components["schemas"]["QualityReview"];
                };
            };
        };
        ScenarioComparisonVariantsEnvelope: {
            data: {
                /** Format: uuid */
                comparison_id: string;
                comparison_type: string;
                differences_summary?: Record<string, never>;
                selected_variant?: string | null;
                selection_reason?: string | null;
                variants: {
                    variant_key: string;
                    variant_label: string;
                    /** Format: uuid */
                    scenario_id?: string | null;
                    scenario_payload: Record<string, never>;
                    cultural_provenance_data?: Record<string, never>[];
                    is_cultural_available?: boolean;
                }[];
            };
        };
        CreatePilotParticipantDTO: {
            subject_area: string;
            teaching_experience_years: number;
            anonymous_code?: string;
            valid_days?: number;
        };
        PilotParticipantListEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                anonymous_code: string;
                subject_area: string;
                teaching_experience_years: number;
                is_submitted: boolean;
                /** Format: date-time */
                expires_at: string;
                is_expired: boolean;
                is_revoked: boolean;
                /** Format: date-time */
                used_at: string | null;
                has_response: boolean;
                /** Format: date-time */
                created_at: string;
                is_synthetic: boolean;
                /** Format: uuid */
                response_id: string | null;
            }[];
        };
        PilotParticipantInviteEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                anonymous_code: string;
                subject_area?: string;
                teaching_experience_years?: number;
                invite_token: string;
                /** Format: date-time */
                expires_at: string;
                notice?: string;
            };
        };
        PilotParticipantRevokeEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                anonymous_code: string;
                /** Format: date-time */
                revoked_at: string;
                message?: string;
            };
        };
        PilotResponseEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** Format: uuid */
                participant_id: string;
                /** Format: uuid */
                scenario_id: string;
                prep_time_baseline_minutes: number;
                prep_time_ai_minutes: number;
                relative_time_saving: number;
                relative_time_saving_percent: number;
                personalization_selected: boolean;
                manual_edit_percentage: number;
                cultural_context_used: boolean;
                cultural_usefulness_score: number | null;
                /** Format: uuid */
                comparison_id: string | null;
                is_synthetic: boolean;
                feedback_text: string | null;
                /** Format: date-time */
                created_at: string;
            };
        };
        CreatePilotReviewFindingDTO: {
            /** @enum {string} */
            expert_audit_status: "pending_audit" | "audited" | "rejected";
            critical_cultural_errors: number;
            methodological_remarks?: string | null;
        };
        PilotReviewFindingEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** Format: uuid */
                pilot_response_id: string;
                expert_name: string;
                /** @enum {string} */
                expert_audit_status: "pending_audit" | "audited" | "rejected";
                critical_cultural_errors: number;
                finding_version: number;
                is_effective: boolean;
                methodological_remarks: string | null;
                /** Format: date-time */
                reviewed_at: string | null;
            };
        };
        PilotExportResponse: {
            data: {
                /** Format: date-time */
                exported_at: string;
                scope: string;
                /** Format: uuid */
                school_id?: string | null;
                metrics: components["schemas"]["PilotMetrics"];
            };
        };
        CalendarOccurrence: {
            /** Format: uuid */
            id: string;
            academic_year: string;
            /** Format: date */
            start_date: string;
            /** Format: date */
            end_date: string | null;
            source_reference: string | null;
        };
        SchoolSettings: {
            address?: string | null;
            phone?: string | null;
            /** Format: email */
            email?: string | null;
            website?: string | null;
            description?: string | null;
        } & {
            [key: string]: unknown;
        };
        SourcePatchEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** Format: uuid */
                calendar_event_id: string;
                /** @enum {string} */
                source_type: "normative_act" | "scientific_publication" | "ethnographic_archive" | "encyclopedia";
                title: string;
                author: string | null;
                url: string | null;
                doi_or_isbn: string | null;
                /** Format: uuid */
                verified_by_user_id: string | null;
                /** Format: date */
                verification_date: string | null;
                /** Format: date-time */
                created_at: string;
            };
        };
        PilotReviewFinding: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            pilot_response_id: string;
            expert_name: string;
            /** @enum {string} */
            expert_audit_status: "pending_audit" | "audited" | "rejected";
            critical_cultural_errors: number;
            finding_version: number;
            is_effective: boolean;
            methodological_remarks: string | null;
            /** Format: date-time */
            reviewed_at: string | null;
        };
        PilotReviewHistoryEnvelope: {
            data: {
                /** Format: uuid */
                pilot_response_id: string;
                effective_review: components["schemas"]["PilotReviewFinding"] | null;
                versions: components["schemas"]["PilotReviewFinding"][];
            };
        };
        PilotMetrics: {
            /** @enum {string} */
            status: "no_data" | "active_pilot" | "completed";
            total_participants: number;
            /** @description Общее количество отправленных анкет педагогов */
            submitted_responses_count: number;
            /** @description Количество проверенных экспертами анкет */
            audited_responses_count: number;
            /** @description Псевдоним для audited_responses_count для обратной совместимости */
            audited_reviews_count: number;
            /** @description Количество анкет, ожидающих экспертной оценки */
            pending_expert_reviews_count: number;
            /** @description Доля проверенных анкет в процентах от общего объема (0.00-100.00%) */
            expert_review_coverage_percent: number | null;
            median_relative_time_saving_percent: number | null;
            /** @description Субъективный выбор персонализации по результатам анкетного опроса */
            personalization_choice_percent: number | null;
            /** @description Субъективный выбор персонализации педагогом в опросе (в отличие от ScenarioComparison::selected_variant) */
            self_reported_personalization_choice_percent: number | null;
            manual_edit_under_20_percent_ratio: number | null;
            cultural_context_usage_percent: number | null;
            average_cultural_usefulness_score: number | null;
            /** @description Количество критических этнокультурных ошибок среди проверенных анкет (null при отсутствии проведенных экспертиз) */
            critical_cultural_errors_count: number | null;
            sample_size: number;
            target_sample_size: number;
            /** @description Завершен ли сбор анкет педагогов (N >= 20) */
            is_survey_completed: boolean;
            /** @description Завершена ли экспертная оценка (N >= 20 и проверено 100% анкет) */
            is_expert_evaluation_completed: boolean;
            /** @description Завершен ли пилот в целом (опрос и экспертиза завершены, критических ошибок 0) */
            is_pilot_completed: boolean;
            criteria_progress: {
                time_saving_ge_50?: boolean;
                personalization_ge_70?: boolean;
                manual_edit_under_20_ge_70?: boolean;
                cultural_usage_ge_60?: boolean;
                cultural_usefulness_ge_4?: boolean;
                zero_critical_cultural_errors?: boolean;
            };
            criteria_status: {
                time_saving_ge_50?: string;
                personalization_ge_70?: string;
                manual_edit_under_20_ge_70?: string;
                cultural_usage_ge_60?: string;
                cultural_usefulness_ge_4?: string;
                zero_critical_cultural_errors?: string;
            };
            sample_breakdown: {
                personalization: {
                    selected: number;
                    total: number;
                };
                manual_edits: {
                    under_20_percent: number;
                    total: number;
                };
                cultural_context: {
                    used: number;
                    rated_count: number;
                    total: number;
                };
                expert_reviews: {
                    audited: number;
                    pending: number;
                    coverage_percent: number | null;
                    critical_errors: number | null;
                };
            };
        };
        ScenarioMutationEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** Format: uuid */
                school_id: string;
                /** Format: uuid */
                scenario_request_id: string;
                title: string;
                /** @enum {string} */
                status: "draft" | "completed" | "archived";
                is_archived: boolean;
                /** Format: uuid */
                current_revision_id?: string | null;
                optimistic_lock_version: number;
                moderation_status: string;
                /** Format: date-time */
                created_at: string;
                /** Format: date-time */
                updated_at: string;
                current_revision: {
                    /** Format: uuid */
                    id?: string;
                    version_number?: number;
                    change_description?: string | null;
                    moderation_status?: string;
                    concept?: string;
                    pedagogical_goal?: string;
                    content_payload?: Record<string, never>;
                    /** Format: date-time */
                    created_at?: string;
                    moderation_state?: {
                        status?: string;
                        p0_violations_count?: number;
                        p1_violations_count?: number;
                        moderator_notes?: string | null;
                        /** Format: date-time */
                        checked_at?: string | null;
                    } | null;
                    signoff?: {
                        /** Format: uuid */
                        id?: string;
                        is_confirmed?: boolean;
                        checklist_confirmed?: Record<string, never>;
                        teacher_notes?: string | null;
                        /** Format: date-time */
                        confirmed_at?: string | null;
                        user?: {
                            /** Format: uuid */
                            id?: string;
                            name?: string;
                        } | null;
                    } | null;
                    stages?: Record<string, never>[];
                    materials?: Record<string, never>[];
                } | null;
            };
        };
        QualityReview: {
            gate_version?: string;
            /** @enum {string} */
            status: "blocked" | "requires_review";
            /** @enum {string} */
            technical_checks: "passed" | "failed";
            /** @constant */
            expert_assessment?: "not_performed";
            /** @constant */
            teacher_signoff_required?: true;
            payload_sha256?: string;
            cultural_coverage: {
                /** @constant */
                status: "requires_review";
                /** @constant */
                complete: false;
                /** @constant */
                whole_document_verified: false;
                scanned_string_count?: number;
                supported_assertions?: Record<string, never>[];
                findings?: Record<string, never>[];
            };
            findings: {
                code: string;
                path: string;
                text: string;
                message: string;
                /** @enum {string} */
                severity: "error" | "review";
            }[];
            limitations?: string[];
        } | null;
    };
    responses: {
        /** @description Отсутствует или недействительна сессия */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Недостаточно прав или попытка доступа к чужой школе */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Ресурс не найден */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Ошибка валидации переданных параметров */
        ValidationError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Конфликт состояния ресурса (например, попытка удаления сценария с подписанным педагогическим допуском) */
        Conflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Некорректный запрос или ошибка параметров */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Format: email
                     * @example teacher@school130.ru
                     */
                    email: string;
                    /**
                     * Format: password
                     * @example SecurePassword2026!
                     */
                    password: string;
                };
            };
        };
        responses: {
            /** @description Успешный вход (сессионная кука laravel_session выставляется в Set-Cookie) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            422: components["responses"]["ValidationError"];
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Успешный выход */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getCurrentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Данные пользователя */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserEnvelope"];
                };
            };
        };
    };
    getCurrentTenant: {
        parameters: {
            query?: never;
            header?: {
                /** @description Идентификатор школы для явного переключения */
                "X-School-Id"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Активный контекст школы */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TenantCurrentEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["ValidationError"];
        };
    };
    getSystemStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Статус системной панели */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SystemStatusEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listCalendarEvents: {
        parameters: {
            query?: {
                /** @example 66 */
                region_code?: string;
                from?: string;
                to?: string;
                type?: "federal" | "regional" | "cultural_traditional" | "school_custom";
                q?: string;
                page?: number;
                per_page?: number;
                academic_year?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Список событий календаря */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CalendarEventListResponse"];
                };
            };
        };
    };
    createCalendarEvent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCalendarEventRequest"];
            };
        };
        responses: {
            /** @description Событие создано */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CalendarEventEnvelope"];
                };
            };
            403: components["responses"]["Forbidden"];
            422: components["responses"]["ValidationError"];
        };
    };
    getCalendarEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Полные данные события */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CalendarEventEnvelope"];
                };
            };
            404: components["responses"]["NotFound"];
        };
    };
    listSchoolTraditions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                schoolId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Список школьных традиций */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TraditionListResponse"];
                };
            };
        };
    };
    createSchoolTradition: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                schoolId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTraditionRequest"];
            };
        };
        responses: {
            /** @description Традиция успешно создана */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
        };
    };
    createTraditionVersion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTraditionVersionRequest"];
            };
        };
        responses: {
            /** @description Версия на учебный год создана */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            422: components["responses"]["ValidationError"];
        };
    };
    createScenarioRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateScenarioRequestDTO"];
            };
        };
        responses: {
            /** @description Запрос сохранен, контекст зафиксирован */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioRequestEnvelope"];
                };
            };
            422: components["responses"]["ValidationError"];
        };
    };
    triggerScenarioGeneration: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Генерация принята в очередь обработки */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GenerationAcceptedResponse"];
                };
            };
            /** @description Конфликт идемпотентности или параллельная обработка */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getGenerationRunStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Статус генерации */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GenerationRunEnvelope"];
                };
            };
        };
    };
    listScenarios: {
        parameters: {
            query?: {
                page?: number;
                per_page?: number;
                q?: string;
                status?: "draft" | "completed" | "archived";
                is_archived?: boolean | ("all" | "true" | "false" | "0" | "1");
                from?: string;
                to?: string;
                sort?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Список сценариев */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioListResponse"];
                };
            };
        };
    };
    getScenario: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Полные данные сценария */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioEnvelope"];
                };
            };
        };
    };
    deleteScenario: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Сценарий успешно удален */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            message: string;
                        };
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
        };
    };
    getScenarioRevision: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description Номер ревизии сценария */
                version: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ревизия сценария успешно получена */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioRevisionEnvelope"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    updateScenarioRevision: {
        parameters: {
            query?: never;
            header: {
                /** @description Текущее значение optimistic_lock_version сценария */
                "If-Match": string;
            };
            path: {
                id: string;
                /** @description Номер текущей ревизии (сверяется с базой) */
                version: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateScenarioRevisionRequest"];
            };
        };
        responses: {
            /** @description Новая ревизия создана, отправлена на модерацию */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioMutationEnvelope"];
                };
            };
            /** @description Конфликт версий или попытка отредактировать устаревшую ревизию */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getRevisionVerifications: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                version: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Находки модерации */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationRunEnvelope"];
                };
            };
        };
    };
    retriggerVerification: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                version: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Повторная проверка поставлена в очередь */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    teacherSignoff: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                version: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TeacherSignoffRequest"];
            };
        };
        responses: {
            /** @description Сценарий подтвержден педагогом */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Блокировка! В ревизии есть неисправленные замечания P0 или не все пункты чек-листа подтверждены */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listRevisionExports: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Идентификатор сценария */
                id: string;
                /** @description Номер ревизии сценария */
                version: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Список сформированных заданий экспорта и артефактов с флагом доступности скачивания */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportJobListEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    requestExport: {
        parameters: {
            query?: never;
            header: {
                /** @description Уникальный ключ идемпотентности операции экспорта */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
                version: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    format: "pdf" | "docx" | "pptx" | "print_pack_pdf";
                    /**
                     * @description Запрещён в текущей версии (возвращает 409 Conflict)
                     * @default false
                     */
                    allow_historical?: boolean;
                };
            };
        };
        responses: {
            /** @description Задача экспорта принята */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Экспорт запрещен при наличии открытых P0-замечаний или отсутствии sign-off */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getExportJobStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Статус сборки и ссылка на скачивание */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportJobEnvelope"];
                };
            };
        };
    };
    downloadExportArtifact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Бинарный поток файла */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/pdf": string;
                };
            };
            404: components["responses"]["NotFound"];
        };
    };
    checkHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Сервис и базы данных функционируют штатно */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example ok */
                        status: string;
                        /** Format: date-time */
                        timestamp: string;
                        services: {
                            /** @example connected */
                            database: string;
                            /** @example connected */
                            redis: string;
                        };
                    };
                };
            };
            /** @description Деградация сервиса (недоступность PostgreSQL или Redis) */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example degraded */
                        status: string;
                        /** Format: date-time */
                        timestamp: string;
                        services: {
                            /** @example disconnected */
                            database: string;
                            /** @example disconnected */
                            redis: string;
                        };
                    };
                };
            };
        };
    };
    getScenarioRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Запрос сценария найден */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioRequestEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    getCatalogReviewQueue: {
        parameters: {
            query?: {
                status?: "pending" | "approved" | "rejected" | "requires_amendment" | "all";
                region_code?: string;
                event_type?: string;
                page?: number;
                per_page?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Список первоисточников в очереди рецензирования */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewQueueResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    getEventSource: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Данные первоисточника */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventSourceEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
        };
    };
    updateEventSource: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title?: string;
                    author?: string | null;
                    /** @enum {string} */
                    source_type?: "normative_act" | "scientific_publication" | "ethnographic_archive" | "encyclopedia";
                    url?: string | null;
                    doi_or_isbn?: string | null;
                };
            };
        };
        responses: {
            /** @description Первоисточник успешно обновлен */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SourcePatchEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
        };
    };
    listEventSourceReviews: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Список экспертных рецензий */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SourceReviewListResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    createEventSourceReview: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    decision: "approved" | "rejected" | "requires_amendment";
                    comments: string;
                };
            };
        };
        responses: {
            /** @description Экспертная рецензия успешно зафиксирована */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SourceReviewEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
        };
    };
    getCulturalClaim: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Данные культурного утверждения */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CulturalClaimEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
        };
    };
    attachCulturalClaimEvidence: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uuid */
                    event_source_id: string;
                    citation_locator: string;
                    citation_excerpt: string;
                    applicable_academic_year?: string | null;
                    notes?: string | null;
                    /** @default true */
                    verify?: boolean | null;
                };
            };
        };
        responses: {
            /** @description Свидетельство успешно привязано/верифицировано */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CulturalClaimEvidenceEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
        };
    };
    detachCulturalClaimEvidence: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                sourceId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    reason?: string | null;
                };
            };
        };
        responses: {
            /** @description Свидетельство успешно отвязано */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            message: string;
                            detached_records_count: number;
                        };
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    getSchoolProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Данные профиля школы */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SchoolProfileEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    updateSchoolProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name?: string;
                    short_name?: string | null;
                    city?: string;
                    inn?: string | null;
                    settings?: components["schemas"]["SchoolSettings"] | null;
                };
            };
        };
        responses: {
            /** @description Профиль школы успешно обновлен */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SchoolProfileEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
        };
    };
    getDashboardSummary: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Сводная информация главной панели */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardSummaryEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    getTradition: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Данные традиции с историей версий */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TraditionDetailEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    updateTradition: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title?: string;
                    description?: string;
                    established_year?: number | null;
                };
            };
        };
        responses: {
            /** @description Традиция успешно обновлена */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TraditionEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
        };
    };
    archiveTradition: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Традиция успешно архивирована */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TraditionEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    archiveScenario: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Сценарий успешно архивирован */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioLifecycleEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    restoreScenario: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Сценарий успешно восстановлен */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioLifecycleEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listScenarioComparisons: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Список сессий сравнения */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ScenarioComparisonItem"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    createScenarioComparison: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateScenarioComparisonDTO"];
            };
        };
        responses: {
            /** @description Сессия сравнения успешно создана */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioComparisonEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
            /** @description Safe LLM configuration failure */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: {
                            code: string;
                            message: string;
                        };
                    };
                };
            };
        };
    };
    getScenarioComparison: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Детали сессии сравнения */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioComparisonEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    getScenarioComparisonVariants: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Варианты A и B с сопоставительными метаданными */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioComparisonVariantsEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    selectScenarioComparisonVariant: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SelectScenarioComparisonVariantDTO"];
            };
        };
        responses: {
            /** @description Выбор педагога успешно сохранен */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScenarioComparisonEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["ValidationError"];
        };
    };
    listPilotParticipants: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Список участников пилота */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotParticipantListEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    createPilotParticipant: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePilotParticipantDTO"];
            };
        };
        responses: {
            /** @description Приглашение успешно создано с одноразовым токеном */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotParticipantInviteEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["ValidationError"];
        };
    };
    reissuePilotParticipantToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Новый токен успешно сгенерирован */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotParticipantInviteEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
        };
    };
    revokePilotParticipantToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Приглашение успешно отозвано */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotParticipantRevokeEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
        };
    };
    submitPilotResponse: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePilotResponseDTO"];
            };
        };
        responses: {
            /** @description Анкета пилота успешно зафиксирована в системе */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotResponseEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["ValidationError"];
        };
    };
    getPilotResponse: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Детали анкеты пилота */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotResponseEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    getPilotReviewHistory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Actual Laravel response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotReviewHistoryEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    submitPilotReviewFinding: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePilotReviewFindingDTO"];
            };
        };
        responses: {
            /** @description Экспертное заключение успешно сохранено */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotReviewFindingEnvelope"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
        };
    };
    getPilotSummaryMetrics: {
        parameters: {
            query?: {
                scope?: "school" | "global";
                /** @description Explicit synthetic inclusion for authorized scope; frontend allows only isolated app-test. */
                include_synthetic?: boolean | (0 | 1);
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Сводные метрики эффективности */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotMetricsResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    exportPilotMetrics: {
        parameters: {
            query?: {
                scope?: "school" | "global";
                /** @description Explicit synthetic inclusion for authorized scope; frontend allows only isolated app-test. */
                include_synthetic?: boolean | (0 | 1);
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Экспорт результатов пилота */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PilotExportResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
}
