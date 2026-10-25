import { DocLink, External, LegalLayout, Mail, type LegalDocument } from '@/components/layout/legalLayout'
import { SITE } from '@/lib/site'

const TERMS: LegalDocument = {
  path: '/terms',
  updated: '2026-10-25',
  content: {
    en: {
      title: 'Terms of service',
      description: 'The rules for using Velio: a free route planner whose routes you check before you ride.',
      body: <TermsEn />,
    },
    es: {
      title: 'Condiciones de uso',
      description: 'Las normas para usar Velio: un planificador de rutas gratuito cuyas rutas revisas antes de salir.',
      body: <TermsEs />,
    },
  },
}

export function TermsPage() {
  return <LegalLayout doc={TERMS} />
}

function TermsEn() {
  return (
    <>
      <p>
        These terms apply when you use Velio at velio.cub1z.es, a free cycling route planner run as a personal project
        by Diego Sanchez in Spain. By creating an account or using the service you accept them. The{' '}
        <DocLink to="/privacy">privacy policy</DocLink> explains how your data is handled.
      </p>

      <h2>The service</h2>
      <p>
        Velio plans loops and point-to-point cycling routes from OpenStreetMap data and elevation models, and lets you
        save and export them. It is free and has no ads. We may change, limit or end features, or the whole service, at
        any time. If Velio closes, we will give notice when we can so you have time to export your routes.
      </p>

      <h2>Your safety comes first</h2>
      <p>
        Routes are generated automatically and are suggestions. Map data can be out of date or wrong: a road may be
        closed, busy, unpaved, private or unsafe for cycling, and surface, traffic and elevation figures are estimates.
        Before and during every ride, check the route, follow traffic laws and signs, and ride within your fitness and
        skills. Where you ride is always your decision.
      </p>

      <h2>Your account</h2>
      <p>
        Use a real email address, keep your password to yourself and tell us if you think someone else is using your
        account. You must be at least 14 years old. You can delete your account at any time in Account settings.
      </p>

      <h2>Fair use</h2>
      <p>
        Do not use Velio to break the law, do not try to reach other people's data or disrupt the service, and do not
        collect routes in bulk with scripts or work around the request limits. We may suspend or delete accounts that
        do.
      </p>

      <h2>Your routes and the map data</h2>
      <p>
        The routes you save are yours. Map data is © <External href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</External>,
        available under the Open Database License (ODbL), and routes derived from it, including GPX and GeoJSON
        exports, carry the same terms. Elevation comes from the Copernicus DEM GLO-30. Velio's source code is free
        software under the GNU AGPL-3.0, <External href={SITE.repoUrl}>on GitHub</External>.
      </p>

      <h2>Liability</h2>
      <p>
        Velio is provided as is and free of charge, with no promise that it will be available, accurate or suitable for
        a particular ride. As far as the law allows, Diego Sanchez is not liable for damage arising from the use of the
        routes or the service. Nothing in these terms limits liability that the law does not allow to be limited, such
        as for intent or gross negligence, or your rights as a consumer.
      </p>

      <h2>Changes and applicable law</h2>
      <p>
        We may update these terms. If a change matters, we will say so in the app or by email before it applies, and you
        can stop using Velio and delete your account. These terms are governed by Spanish law; as a consumer you keep
        the protection of the laws and courts of the place where you live.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <Mail />.
      </p>
    </>
  )
}

function TermsEs() {
  return (
    <>
      <p>
        Estas condiciones se aplican cuando usas Velio en velio.cub1z.es, un planificador de rutas en bici gratuito, un
        proyecto personal de Diego Sanchez desde España. Al crear una cuenta o usar el servicio, las aceptas. La{' '}
        <DocLink to="/privacy">política de privacidad</DocLink> explica cómo se tratan tus datos.
      </p>

      <h2>El servicio</h2>
      <p>
        Velio planifica circuitos y rutas de punto a punto en bici a partir de datos de OpenStreetMap y modelos de
        elevación, y te permite guardarlas y exportarlas. Es gratuito y no tiene anuncios. Podemos cambiar, limitar o
        retirar funciones, o el servicio entero, en cualquier momento. Si Velio cierra, avisaremos con antelación siempre
        que podamos para que tengas tiempo de exportar tus rutas.
      </p>

      <h2>Tu seguridad es lo primero</h2>
      <p>
        Las rutas se generan de forma automática y son sugerencias. Los datos del mapa pueden estar desactualizados o
        ser erróneos: una carretera puede estar cortada, tener mucho tráfico, no estar asfaltada, ser privada o no ser
        segura para la bici, y las cifras de firme, tráfico y desnivel son estimaciones. Antes y durante cada salida,
        revisa la ruta, cumple las normas y señales de tráfico, y rueda dentro de tu forma física y tu nivel. Por dónde
        ruedas lo decides siempre tú.
      </p>

      <h2>Tu cuenta</h2>
      <p>
        Usa un correo real, no compartas tu contraseña y avísanos si crees que otra persona está usando tu cuenta. Debes
        tener al menos 14 años. Puedes borrar tu cuenta cuando quieras en Ajustes de cuenta.
      </p>

      <h2>Uso razonable</h2>
      <p>
        No uses Velio para infringir la ley, no intentes acceder a datos de otras personas ni entorpecer el servicio, y
        no descargues rutas de forma masiva con scripts ni te saltes los límites de peticiones. Podemos suspender o
        borrar las cuentas que lo hagan.
      </p>

      <h2>Tus rutas y los datos del mapa</h2>
      <p>
        Las rutas que guardas son tuyas. Los datos del mapa son ©{' '}
        <External href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</External>, disponibles
        bajo la Open Database License (ODbL), y las rutas derivadas de ellos, incluidas las exportaciones en GPX y
        GeoJSON, se rigen por los mismos términos. La elevación procede del Copernicus DEM GLO-30. El código de Velio es
        software libre bajo la licencia GNU AGPL-3.0, <External href={SITE.repoUrl}>en GitHub</External>.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        Velio se ofrece tal cual y de forma gratuita, sin garantía de que esté disponible, sea exacto o sirva para una
        salida concreta. En la medida en que la ley lo permita, Diego Sanchez no responde de los daños derivados del uso
        de las rutas o del servicio. Nada de estas condiciones limita la responsabilidad que la ley no permite limitar,
        como la derivada de dolo o culpa grave, ni tus derechos como consumidor.
      </p>

      <h2>Cambios y ley aplicable</h2>
      <p>
        Podemos actualizar estas condiciones. Si un cambio es importante, lo avisaremos en la app o por correo antes de
        que se aplique, y podrás dejar de usar Velio y borrar tu cuenta. Estas condiciones se rigen por la ley española;
        como consumidor, conservas la protección de las leyes y los tribunales del lugar donde vives.
      </p>

      <h2>Contacto</h2>
      <p>
        Dudas sobre estas condiciones: <Mail />.
      </p>
    </>
  )
}
