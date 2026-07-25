import { SkeletonScreen } from '@/components/ui/SkeletonScreen'
import { t } from '@/i18n'

export function InstallGuideScreen() {
  return (
    <SkeletonScreen
      title={t('settings.install')}
      heading={t('install.heading')}
      description={t('install.intro')}
    >
      <ol className="stack" style={{ listStyle: 'decimal', paddingLeft: '1.25rem' }}>
        <li>{t('install.step1')}</li>
        <li>{t('install.step2')}</li>
        <li>{t('install.step3')}</li>
        <li>{t('install.step4')}</li>
      </ol>
    </SkeletonScreen>
  )
}
