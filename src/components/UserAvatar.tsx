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
 * que las trae con el de la sesión. Sin foto, o si no carga, un círculo con la
 * inicial del login.
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
  return (
    <span className="app__avatar app__avatar--initial" aria-hidden="true">
      {login.charAt(0).toUpperCase()}
    </span>
  )
}

export default UserAvatar
