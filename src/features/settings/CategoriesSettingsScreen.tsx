import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category } from '@/domain/types'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t, type TranslationKey } from '@/i18n'
import {
  ASSIGNABLE_CATEGORY_KINDS,
  filterCategoriesByKind,
  normalizeCategoryKind,
  type AssignableCategoryKind,
} from '@/services/category'
import {
  IntegrityError,
  archiveCategory,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '@/repositories'

export function CategoriesSettingsScreen() {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AssignableCategoryKind>('expense')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editKind, setEditKind] = useState<AssignableCategoryKind>('expense')

  const reload = useCallback(async () => {
    setCategories(await listCategories())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const expenseCategories = useMemo(
    () => filterCategoriesByKind(categories, 'expense'),
    [categories],
  )
  const incomeCategories = useMemo(
    () => filterCategoriesByKind(categories, 'income'),
    [categories],
  )

  async function onAdd() {
    setError(null)
    if (!name.trim()) {
      setError(t('errors.requiredName'))
      return
    }
    try {
      await createCategory({ name, kind })
      setName('')
      await reload()
    } catch {
      setError(t('errors.generic'))
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id)
    setEditName(category.name)
    setEditKind(normalizeCategoryKind(category.kind))
    setError(null)
  }

  async function onSaveEdit() {
    if (!editingId) return
    setError(null)
    if (!editName.trim()) {
      setError(t('errors.requiredName'))
      return
    }
    try {
      await updateCategory(editingId, { name: editName, kind: editKind })
      setEditingId(null)
      await reload()
    } catch {
      setError(t('errors.generic'))
    }
  }

  async function toggleFavorite(category: Category) {
    await updateCategory(category.id, { isFavorite: !category.isFavorite })
    await reload()
  }

  function renderList(rows: Category[], headingKey: TranslationKey) {
    return (
      <div className="stack">
        <p className="field__label">{t(headingKey)}</p>
        {rows.length === 0 ? (
          <p className="screen__note">{t('settings.emptyList')}</p>
        ) : (
          rows.map((category) => {
            const isEditing = editingId === category.id
            return (
              <div key={category.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div className="stack" style={{ gap: '4px', width: '100%' }}>
                  {isEditing ? (
                    <>
                      <label className="field">
                        <span className="field__label">{t('settings.name')}</span>
                        <input
                          className="field__control"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">{t('settings.kind')}</span>
                        <select
                          className="field__control"
                          value={editKind}
                          onChange={(e) =>
                            setEditKind(e.target.value as AssignableCategoryKind)
                          }
                        >
                          {ASSIGNABLE_CATEGORY_KINDS.map((item) => (
                            <option key={item} value={item}>
                              {t(`categoryKinds.${item}` as TranslationKey)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void onSaveEdit()}
                        >
                          {t('app.save')}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setEditingId(null)}
                        >
                          {t('app.cancel')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>{category.name}</strong>
                      <span className="screen__note">
                        {t(`categoryKinds.${normalizeCategoryKind(category.kind)}` as TranslationKey)}
                        {category.isFavorite ? ` · ${t('settings.favorite')}` : ''}
                      </span>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => startEdit(category)}
                        >
                          {t('app.edit')}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void toggleFavorite(category)}
                        >
                          {t('settings.favorite')}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void archiveCategory(category.id).then(reload)}
                        >
                          {t('app.archive')}
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => {
                            void deleteCategory(category.id)
                              .then(reload)
                              .catch((cause: unknown) => {
                                setError(
                                  cause instanceof IntegrityError
                                    ? cause.message
                                    : t('settings.cannotDeleteHasHistory'),
                                )
                              })
                          }}
                        >
                          {t('app.delete')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <SettingsLayout
      title={t('settings.categories')}
      heading={t('settings.categories')}
      error={error}
    >
      {renderList(expenseCategories, 'settings.expenseCategories')}
      {renderList(incomeCategories, 'settings.incomeCategories')}

      <div className="stack skeleton-block">
        <label className="field">
          <span className="field__label">{t('settings.name')}</span>
          <input className="field__control" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('settings.kind')}</span>
          <select
            className="field__control"
            value={kind}
            onChange={(e) => setKind(e.target.value as AssignableCategoryKind)}
          >
            {ASSIGNABLE_CATEGORY_KINDS.map((item) => (
              <option key={item} value={item}>
                {t(`categoryKinds.${item}` as TranslationKey)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary-button" onClick={() => void onAdd()}>
          {t('app.add')}
        </button>
      </div>
    </SettingsLayout>
  )
}
