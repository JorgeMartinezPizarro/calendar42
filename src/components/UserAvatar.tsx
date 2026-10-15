import { useState } from 'react'

interface UserAvatarProps {
  /** URL de la foto que da la intra, o null (demo, o usuario sin foto). */
  image: string | null
  login: string
}

/** Identificador corto de la URL, para que el navegador no reutilice una foto anterior. */
function versionOf(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

/**
 * Foto del usuario en la cabecera. El CDN de la intra solo sirve las fotos con
 * el token del usuario, así que se piden a la API propia (/api/auth/avatar),
 * que las trae con el de la sesión. Sin foto, una silueta de usuario; si la
 * foto no carga, la inicial del login.
 */
function UserAvatar({ image, login }: UserAvatarProps) {
  // La foto que falló: si la sesión trae otra, se vuelve a intentar.
  const [failed, setFailed] = useState<string | null>(null)

  if (image && failed !== image) {
    return (
      <img
        className="app__avatar"
        src={`/api/auth/avatar?v=${versionOf(image)}`}
        alt=""
        width="28"
        height="28"
        onError={() => setFailed(image)}
      />
    )
  }
  // Sin foto (el demo, o un usuario sin foto en la intra): una silueta. Si la
  // foto existe pero no carga, la inicial del login, que sí le identifica.
  if (!image) {
    return (
      <span className="app__avatar app__avatar--initial" aria-hidden="true">
        {/* Cabeza y hombros; el círculo recorta los hombros por abajo. */}
        <svg className="app__avatar-figure" viewBox="0 0 16 16" width="22" height="22" fill="currentColor">
          <circle cx="8" cy="5.4" r="3.1" />
          <path d="M1.8 16.5c0-3.9 2.8-6.6 6.2-6.6s6.2 2.7 6.2 6.6z" />
        </svg>
      </span>
    )
  }
  return (
    <span className="app__avatar app__avatar--initial" aria-hidden="true">
      {login.charAt(0).toUpperCase()}
    </span>
  )
}

export default UserAvatar
