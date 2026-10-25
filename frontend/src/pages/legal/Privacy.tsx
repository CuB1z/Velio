import { DocLink, External, LegalLayout, Mail, type LegalDocument } from '@/components/layout/LegalLayout'

const PRIVACY: LegalDocument = {
  path: '/privacy',
  updated: '2026-10-25',
  content: {
    en: {
      title: 'Privacy policy',
      description: 'What Velio stores about you, why, who helps run it, how long it is kept and how to delete it.',
      body: <PrivacyEn />,
    },
    es: {
      title: 'Política de privacidad',
      description: 'Qué datos guarda Velio, para qué, quién ayuda a gestionarlos, cuánto tiempo se conservan y cómo borrarlos.',
      body: <PrivacyEs />,
    },
  },
}

export function PrivacyPage() {
  return <LegalLayout doc={PRIVACY} />
}

function PrivacyEn() {
  return (
    <>
      <p>
        Velio is a free cycling route planner, run as a personal project by Diego Sanchez in Spain. This policy explains
        which personal data Velio processes, why, for how long and what you can do about it. Velio has no ads, no
        analytics and no tracking cookies, so the list is short.
      </p>

      <h2>Who is responsible</h2>
      <p>
        Diego Sanchez is the controller of your data. For any question or request about it, write to <Mail />.
      </p>

      <h2>What we process and why</h2>
      <ul>
        <li>
          <strong>Your account.</strong> Your email address, your name and a hash of your password (never the password
          itself). If you sign in with Google, Google shares your account ID, email address and name instead of a
          password. We need them to create your account and sign you in, as part of the service you sign up for.
        </li>
        <li>
          <strong>Codes and sessions.</strong> The six-digit codes we email to confirm your address, reset your password
          or delete your account, stored as a hash for 15 minutes, and your open sessions with the browser that started
          them, for up to 7 days. They keep your account secure.
        </li>
        <li>
          <strong>Saved routes.</strong> The name and the route of every route you save, including its start point and
          stops, which can reveal places you visit. They are kept until you delete them or your account.
        </li>
        <li>
          <strong>Routes you plan.</strong> The points you send to plan a loop or a route are used to compute it and are
          not stored unless you save the route.
        </li>
        <li>
          <strong>Country requests.</strong> If you ask for your country, we store the country, the note you add and who
          asked: your account when you are signed in, or the email address you give when you are not, so that each
          person counts once. If you also tick “Email me when it arrives”, we keep your language and write to you once,
          from Velio's contact address, when Velio can plan routes there. That email rests on your consent, which you can
          withdraw at any time by writing to <Mail />; without the tick we never write to you.
        </li>
        <li>
          <strong>Contact list.</strong> When your account is activated, your email address joins Velio's contact list at
          our email provider, so we can tell you about important changes to the service. It leaves the list when you
          delete your account.
        </li>
        <li>
          <strong>Technical data.</strong> Your IP address and requests reach the server, which keeps short rotating logs
          to run the service and protect it from abuse. IP addresses are also held in memory for a minute to apply
          request limits. This rests on our legitimate interest in keeping Velio secure.
        </li>
      </ul>

      <h2>What stays in your browser</h2>
      <p>
        Velio uses no cookies. Your browser keeps your session token, so you stay signed in, and your language and theme
        choices in its local storage. Only the session token is ever sent to Velio. Your location is read only if you
        allow it, to centre the planner on you.
      </p>
      <p>
        The map loads directly from OpenFreeMap (map tiles), Esri (satellite imagery) and Amazon Web Services (terrain
        relief). Like any website, those providers receive your IP address and the part of the map you are looking at.
      </p>

      <h2>Who helps us run Velio</h2>
      <ul>
        <li>
          <strong>Contabo GmbH</strong> (Germany) hosts the server and the database.
        </li>
        <li>
          <strong>Backblaze, Inc.</strong> stores encrypted daily backups of the database in its European data centre
          in Amsterdam.
        </li>
        <li>
          <strong>Brevo</strong> (Sendinblue SAS, France) sends the account emails and keeps the contact list.
        </li>
        <li>
          <strong>Cloudflare, Inc.</strong> provides DNS and network protection for velio.cub1z.es.
        </li>
        <li>
          <strong>Google</strong> takes part if you choose to sign in with Google, and as the provider of Velio's contact
          mailbox, from which we answer your messages and send the single email you asked for about a country, under{' '}
          <External href="https://policies.google.com/privacy">its own privacy policy</External>.
        </li>
      </ul>
      <p>
        We do not sell your data or share it with anyone else unless the law requires it. Where a provider handles data
        outside the European Economic Area, the transfer is covered by the safeguards the GDPR requires, such as the
        EU–US Data Privacy Framework or the European Commission's standard contractual clauses.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your account, saved routes and country requests: until you delete them or your account.</li>
        <li>
          Deleting your account erases it from the database and the contact list at once. Copies in the encrypted
          backups are gone within 21 days: backups are kept for 14 days, and deleted backups for 7 more.
        </li>
        <li>Verification codes: 15 minutes. Sessions: 7 days.</li>
        <li>Server logs: overwritten as they rotate, usually within days.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or delete your data, object to or restrict its processing, and withdraw any
        consent by writing to <Mail />. Most of it you can do yourself: change your name and password in Account
        settings, export any saved route as GPX or GeoJSON, and delete your account in Account settings, which erases
        your data.
      </p>
      <p>
        If you think your data is handled unlawfully, you can complain to the Spanish Data Protection Agency (
        <External href="https://www.aepd.es">AEPD</External>).
      </p>

      <h2>Age</h2>
      <p>Velio is not meant for anyone under 14.</p>

      <h2>Changes</h2>
      <p>
        If this policy changes in a way that matters, we will say so in the app or by email before the change applies.
        The date at the top shows the current version. The <DocLink to="/terms">terms of service</DocLink> cover the
        rest of the rules for using Velio.
      </p>
    </>
  )
}

function PrivacyEs() {
  return (
    <>
      <p>
        Velio es un planificador de rutas en bici gratuito, un proyecto personal de Diego Sanchez desde España. Esta
        política explica qué datos personales trata Velio, para qué, durante cuánto tiempo y qué puedes hacer con ellos.
        Velio no tiene anuncios, ni analítica, ni cookies de seguimiento, así que la lista es corta.
      </p>

      <h2>Responsable</h2>
      <p>
        Diego Sanchez es el responsable del tratamiento de tus datos. Para cualquier duda o solicitud sobre ellos,
        escribe a <Mail />.
      </p>

      <h2>Qué datos tratamos y para qué</h2>
      <ul>
        <li>
          <strong>Tu cuenta.</strong> Tu correo, tu nombre y un hash de tu contraseña (nunca la contraseña en sí). Si
          entras con Google, Google nos facilita tu identificador de cuenta, tu correo y tu nombre en lugar de una
          contraseña. Los necesitamos para crear tu cuenta e iniciar tu sesión, como parte del servicio al que te
          registras.
        </li>
        <li>
          <strong>Códigos y sesiones.</strong> Los códigos de seis cifras que te enviamos para confirmar tu correo,
          cambiar la contraseña o borrar la cuenta, guardados como hash durante 15 minutos, y tus sesiones abiertas con
          el navegador desde el que se iniciaron, durante 7 días como máximo. Sirven para mantener tu cuenta segura.
        </li>
        <li>
          <strong>Rutas guardadas.</strong> El nombre y el recorrido de cada ruta que guardas, con su punto de salida y
          sus paradas, que pueden revelar lugares que frecuentas. Se conservan hasta que las borres o borres tu cuenta.
        </li>
        <li>
          <strong>Rutas que planificas.</strong> Los puntos que envías para planificar un circuito o una ruta se usan
          para calcularla y no se guardan salvo que guardes la ruta.
        </li>
        <li>
          <strong>Peticiones de país.</strong> Si pides tu país, guardamos el país, la nota que añadas y quién lo pide: tu
          cuenta si has iniciado sesión, o el correo que nos des si no, para contar a cada persona una vez. Si además
          marcas «Avísame cuando llegue», guardamos tu idioma y te escribimos una sola vez, desde la dirección de
          contacto de Velio, cuando Velio pueda planificar rutas allí. Ese correo se basa en tu consentimiento, que
          puedes retirar cuando quieras escribiendo a <Mail />; sin esa casilla, nunca te escribimos.
        </li>
        <li>
          <strong>Lista de contactos.</strong> Cuando activas tu cuenta, tu correo entra en la lista de contactos de
          Velio en nuestro proveedor de correo, para avisarte de cambios importantes en el servicio. Sale de la lista al
          borrar tu cuenta.
        </li>
        <li>
          <strong>Datos técnicos.</strong> Tu dirección IP y tus peticiones llegan al servidor, que guarda registros
          breves y rotativos para que el servicio funcione y protegerlo de abusos. Las IP también se mantienen en
          memoria durante un minuto para aplicar los límites de peticiones. Se basa en nuestro interés legítimo en
          mantener Velio seguro.
        </li>
      </ul>

      <h2>Lo que se queda en tu navegador</h2>
      <p>
        Velio no usa cookies. Tu navegador guarda en su almacenamiento local el token de sesión, para que no tengas que
        volver a entrar, y tus preferencias de idioma y tema. Solo el token de sesión se envía a Velio. Tu ubicación
        solo se lee si lo permites, para centrar el planificador donde estás.
      </p>
      <p>
        El mapa se carga directamente desde OpenFreeMap (mapa), Esri (imagen de satélite) y Amazon Web Services
        (relieve). Como con cualquier web, esos proveedores reciben tu dirección IP y la zona del mapa que estás viendo.
      </p>

      <h2>Quién nos ayuda a gestionar Velio</h2>
      <ul>
        <li>
          <strong>Contabo GmbH</strong> (Alemania) aloja el servidor y la base de datos.
        </li>
        <li>
          <strong>Backblaze, Inc.</strong> guarda copias de seguridad diarias y cifradas de la base de datos en su centro
          de datos europeo, en Ámsterdam.
        </li>
        <li>
          <strong>Brevo</strong> (Sendinblue SAS, Francia) envía los correos de la cuenta y mantiene la lista de
          contactos.
        </li>
        <li>
          <strong>Cloudflare, Inc.</strong> presta el DNS y la protección de red de velio.cub1z.es.
        </li>
        <li>
          <strong>Google</strong> interviene si eliges entrar con Google y como proveedor del buzón de contacto de Velio,
          desde el que respondemos a tus mensajes y enviamos el único correo que pediste sobre un país, según{' '}
          <External href="https://policies.google.com/privacy?hl=es">su propia política de privacidad</External>.
        </li>
      </ul>
      <p>
        No vendemos tus datos ni los compartimos con nadie más salvo que la ley lo exija. Cuando un proveedor trata datos
        fuera del Espacio Económico Europeo, la transferencia está cubierta por las garantías que exige el RGPD, como el
        Marco de Privacidad de Datos UE-EE. UU. o las cláusulas contractuales tipo de la Comisión Europea.
      </p>

      <h2>Cuánto tiempo los conservamos</h2>
      <ul>
        <li>Tu cuenta, tus rutas guardadas y tus peticiones de país: hasta que los borres o borres tu cuenta.</li>
        <li>
          Al borrar tu cuenta, desaparece de la base de datos y de la lista de contactos en el acto. Las copias en las
          copias de seguridad cifradas desaparecen en un máximo de 21 días: las copias se conservan 14 días, y las
          borradas, 7 más.
        </li>
        <li>Códigos de verificación: 15 minutos. Sesiones: 7 días.</li>
        <li>Registros del servidor: se sobrescriben al rotar, normalmente en unos días.</li>
      </ul>

      <h2>Tus derechos</h2>
      <p>
        Puedes acceder a tus datos, rectificarlos, exportarlos o suprimirlos, oponerte a su tratamiento o limitarlo, y
        retirar cualquier consentimiento escribiendo a <Mail />. Casi todo lo puedes hacer tú: cambiar tu nombre y tu
        contraseña en Ajustes de cuenta, exportar cualquier ruta guardada en GPX o GeoJSON, y borrar tu cuenta en
        Ajustes de cuenta, lo que elimina tus datos.
      </p>
      <p>
        Si crees que tus datos se tratan de forma ilícita, puedes reclamar ante la Agencia Española de Protección de
        Datos (<External href="https://www.aepd.es">AEPD</External>).
      </p>

      <h2>Edad</h2>
      <p>Velio no está pensado para menores de 14 años.</p>

      <h2>Cambios</h2>
      <p>
        Si esta política cambia en algo importante, lo avisaremos en la app o por correo antes de que se aplique. La
        fecha de arriba indica la versión vigente. Las <DocLink to="/terms">condiciones de uso</DocLink> recogen el
        resto de normas para usar Velio.
      </p>
    </>
  )
}
