const fs = require('fs');
const path = './src/locales/';

['en.json', 'es.json'].forEach(file => {
  const p = path + file;
  let data = JSON.parse(fs.readFileSync(p, 'utf8'));
  
  if (!data.queue) data.queue = {};
  
  const translations = {
    postDetails: "Post Details",
    scheduledFor: "Scheduled for",
    publishedOn: "Published on",
    noDate: "No date scheduled",
    publishingFailed: "Publishing Failed",
    viewRawError: "View raw error details",
    content: "Content",
    noBodyText: "No body text",
    media: "Media",
    platforms: "Platforms",
    customCopy: "Custom Copy",
    copy: "Copy",
    threadTweets: "Thread Tweets",
    firstComment: "First Comment",
    customMedia: "Custom Media",
    confirmDelete: "Are you sure you want to delete this post?",
    postDeleted: "Post deleted",
    published: "Published!",
    postPaused: "Post paused",
    postResumed: "Post resumed",
    retrying: "Retrying post...",
    noTextContent: "No text content...",
    pause: "Pause",
    edit: "Edit",
    resume: "Resume",
    retry: "Retry",
    publishNow: "Publish Now",
    delete: "Delete"
  };

  const translationsEs = {
    postDetails: "Detalles del Post",
    scheduledFor: "Programado para",
    publishedOn: "Publicado el",
    noDate: "Sin fecha programada",
    publishingFailed: "Fallo en la publicación",
    viewRawError: "Ver error detallado",
    content: "Contenido",
    noBodyText: "Sin texto",
    media: "Multimedia",
    platforms: "Plataformas",
    customCopy: "Texto personalizado",
    copy: "Texto",
    threadTweets: "Hilos (Tweets)",
    firstComment: "Primer comentario",
    customMedia: "Multimedia personalizada",
    confirmDelete: "¿Seguro que quieres eliminar este post?",
    postDeleted: "Post eliminado",
    published: "¡Publicado!",
    postPaused: "Post pausado",
    postResumed: "Post reanudado",
    retrying: "Reintentando post...",
    noTextContent: "Sin contenido de texto...",
    pause: "Pausar",
    edit: "Editar",
    resume: "Reanudar",
    retry: "Reintentar",
    publishNow: "Publicar Ahora",
    delete: "Eliminar"
  };

  const t = file === 'en.json' ? translations : translationsEs;
  
  for (const [key, val] of Object.entries(t)) {
    if (!data.queue[key]) {
      data.queue[key] = val;
    }
  }

  fs.writeFileSync(p, JSON.stringify(data, null, 4), 'utf8');
});
