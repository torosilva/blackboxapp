import React, { useState, useEffect } from 'react';
import { Zap, ArrowRight, ShieldAlert, BarChart3, Menu, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Terms from './Terms';
import Privacy from './Privacy';
import { supabase } from './lib/supabase';
// Import removed as it was unused
import { createPublicInvitation } from './lib/invites';

const Typewriter = ({ text, delay = 50, startDelay = 0 }: { text: string, delay?: number, startDelay?: number }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          setDisplayedText(text.substring(0, i + 1));
          i++;
        } else {
          clearInterval(interval);
        }
      }, delay);

      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(startTimeout);
  }, [text, delay, startDelay]);

  return <span>{displayedText}</span>;
};

function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [currentScreen, setCurrentScreen] = useState(0);
  const [honeypot, setHoneypot] = useState(''); // Bot protection

  const screens = [
    '/assets/screen1.jpg',
    '/assets/screen2.jpg',
    '/assets/screen3.jpg'
  ];

  const nextScreen = () => setCurrentScreen((prev) => (prev + 1) % screens.length);
  const prevScreen = () => setCurrentScreen((prev) => (prev - 1 + screens.length) % screens.length);

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedPrivacy) {
      alert('Debes aceptar el Aviso de Privacidad para continuar.');
      return;
    }

    if (honeypot) {
      console.log('Bot detected via honeypot');
      return; // Silently fail for bots
    }

    setIsLoading(true);

    try {
      // 1. Guardar en Waitlist (Backup log) - Usamos upsert para evitar error de duplicados
      await supabase.from('waitlist').upsert([{ email }], { onConflict: 'email' });

      // 2. Generar Invitación (Pero no enviamos mail todavía)
      await createPublicInvitation(email);

      // 3. Notificar al Admin (torosilva@gmail.com)
      try {
        await supabase.functions.invoke('notify-admin-signup', {
          body: { email }
        });
      } catch (notifyError: any) {
        console.error('Error notificando al administrador:', notifyError);
      }

      setIsJoined(true);
      setEmail('');
      setAcceptedPrivacy(false);
    } catch (error: any) {
      console.error('Error fatal al unirse:', error);
      alert(`Hubo un error: ${error.message || 'Intenta de nuevo.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1021] text-white font-sans selection:bg-indigo-500 selection:text-white">

      {/* --- NAVBAR --- */}
      <nav className="fixed w-full z-50 bg-[#0B1021]/60 backdrop-blur-lg border-b border-white/5 h-24">
        <div className="max-w-7xl mx-auto px-6 h-full flex justify-end items-center relative">

          {/* Logo Flotante Independiente - Tamaño Premium */}
          <a href="#" className="absolute left-6 top-4 z-[60] block hover:scale-105 transition-transform duration-300">
            <img
              src="/assets/logo-v3.png"
              alt="Blackbox Mind Logo"
              className="h-20 md:h-26 w-auto drop-shadow-[0_0_20px_rgba(99,102,241,0.4)] select-none"
            />
          </a>

          {/* Desktop Links a la derecha */}
          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Características</a>
            <a href="#manifesto" className="hover:text-white transition-colors">Manifiesto</a>
            <a href="#cta" className="hover:text-white transition-colors">Únete</a>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-gray-300 z-50" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-[#151B33] border-b border-white/10 p-6 space-y-4">
            <a href="#features" className="block text-gray-300">Características</a>
            <a href="#manifesto" className="block text-gray-300">Manifiesto</a>
            <a href="#cta" className="block text-gray-300">Únete</a>
            <button className="w-full bg-indigo-600 py-3 rounded-lg font-bold">Solicitar Acceso</button>
          </div>
        )}
      </nav>

      {/* --- HERO SECTION --- (Balanceado para armonía visual) */}
      <section id="hero" className="relative pt-36 pb-16 px-6 overflow-hidden min-h-[85vh] flex items-center">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -z-10"></div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-full mb-8 animate-pulse">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <span className="text-xs font-bold tracking-widest text-indigo-400">BETA PRIVADA ABIERTA</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight">
              Cargas demasiado. <br />
              Y se te cae <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">lo que importa.</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Para directores que deciden con la cabeza llena. BLACKBOX descarga el ruido, expone tus sesgos y te devuelve solo lo que exige acción.
            </p>

            {isJoined ? (
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-8 rounded-2xl animate-in fade-in zoom-in duration-500">
                <h3 className="text-2xl font-bold mb-2 text-indigo-400">¡Ya eres parte de la resistencia!</h3>
                <p className="text-gray-400">Estamos procesando tu acceso PRO. Te notificaremos pronto por correo.</p>
              </div>
            ) : (
              <form onSubmit={handleJoinWaitlist} className="space-y-4 max-w-md mx-auto lg:mx-0">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Honeypot field - Invisible to humans */}
                  <div className="absolute opacity-0 -z-50 pointer-events-none" aria-hidden="true">
                    <input
                      type="text"
                      name="website"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="tu@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="bg-[#151B33] border border-white/10 px-6 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-full sm:w-72 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold px-8 py-4 rounded-xl hover:scale-105 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Unirme a F&F</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center space-x-3 text-left">
                  <input
                    type="checkbox"
                    id="privacy-hero"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    disabled={isLoading}
                    className="w-4 h-4 rounded border-white/20 bg-[#151B33] text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                  />
                  <label htmlFor="privacy-hero" className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
                    He leído y acepto el <Link to="/privacy" className="text-indigo-400 hover:underline">Aviso de Privacidad</Link>.
                  </label>
                </div>
              </form>
            )}
            <p className="text-gray-500 text-xs mt-4">Spots limitados para iOS y Android.</p>
          </div>

          {/* Hero Image / UI Mockup - Escala Reducida para Balance */}
          <div className="relative mx-auto w-full max-w-44 md:max-w-48 lg:max-w-56 scale-90 lg:scale-100">
            {/* Phone Border */}
            <div className="relative rounded-[2rem] border-[6px] border-[#1a1f2e] bg-[#0B1021] overflow-hidden shadow-2xl shadow-indigo-900/40 aspect-[9/19]">
              {/* Carousel Content */}
              <div className="relative h-full w-full group/carousel">
                <img
                  src={screens[currentScreen]}
                  alt={`App Screen ${currentScreen + 1}`}
                  className="w-full h-full object-cover transition-opacity duration-500"
                />

                {/* Navigation Arrows */}
                <button
                  onClick={prevScreen}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-indigo-600"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>

                <button
                  onClick={nextScreen}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-indigo-600"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>

                {/* Indicators */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {screens.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all ${i === currentScreen ? 'bg-indigo-500 w-4' : 'bg-white/20'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Floating Badge */}
            <div className="absolute top-20 -right-12 bg-[#151B33]/90 backdrop-blur border border-white/10 p-4 rounded-xl shadow-xl animate-bounce duration-[3000ms]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs font-bold">Análisis Clínico Listo</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* --- EL MOMENTO (Te suena) --- */}
      <section id="momento" className="py-24 px-6 bg-[#0B1021] relative overflow-hidden scroll-mt-32">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center space-x-3 mb-8">
            <div className="h-px w-6 bg-indigo-500/50"></div>
            <span className="text-indigo-400 font-bold tracking-[0.4em] uppercase text-[9px]">Te suena</span>
            <div className="h-px w-6 bg-indigo-500/50"></div>
          </div>

          <p className="text-xl md:text-3xl font-light leading-relaxed text-gray-200 mb-8">
            Estás cenando. Tu pareja te cuenta algo importante de su día. Tu hijo te dice algo que no querías olvidar.
            <br className="hidden md:block" />
            <span className="text-white font-semibold"> Treinta segundos después, ya no está en tu cabeza.</span>
          </p>

          <p className="text-base md:text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
            No es que no te importe. Es que cargas 70 cosas y el cerebro tira lo que no aguanta.
            Y duele distinto cuando lo que se cayó era de alguien que te importa.
          </p>

          <p className="text-lg md:text-2xl font-light text-gray-300 mt-12">
            BLACKBOX es donde sueltas esa carga —{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 font-bold">
              y lo que de verdad pesa, te vuelve cuando tienes que actuar.
            </span>
          </p>
        </div>
      </section>

      {/* --- POR QUÉ NO ES OTRO CHAT --- */}
      <section className="py-16 px-6 bg-[#0F1426] border-y border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-base md:text-xl text-gray-400 leading-relaxed">
            ChatGPT te responde lo que preguntas y lo olvida.
            <br />
            <strong className="text-white font-semibold">
              BLACKBOX vigila —durante meses— lo que se te está cayendo, y te lo devuelve cuando importa.
            </strong>
            <br />
            <span className="text-gray-500">No es una conversación. Es memoria que trabaja por ti.</span>
          </p>
        </div>
      </section>

      {/* --- FEATURES GRID --- */}
      <section id="features" className="py-24 px-6 bg-[#0B1021] scroll-mt-32">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Más allá de un simple diario.</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Tecnología diseñada para el alto rendimiento ejecutivo.</p>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Feature 1: Detector de Sesgos */}
          <div className="group relative bg-gradient-to-b from-white/5 to-transparent p-8 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all duration-500 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-7 h-7 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold mb-3">Detector de Sesgos</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              La IA no te da la razón; te desafía. Detecta falacias lógicas y sesgos.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group relative bg-gradient-to-b from-white/5 to-transparent p-8 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all duration-500 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <Zap className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Active Loops</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              Convierte quejas en tareas. Blackbox te persigue hasta que cierres el ciclo.
            </p>
          </div>

          {/* Feature 3: Buscador de Memorias */}
          <div className="group relative bg-gradient-to-b from-white/5 to-transparent p-8 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all duration-500 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <Search className="w-7 h-7 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Buscador de Memorias</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              Busca lo que sea dentro de tu timeline. Tu vida, indexada por IA.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="group relative bg-gradient-to-b from-white/5 to-transparent p-8 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all duration-500 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Reporte Clínico</h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              Análisis semanal de patrones de estrés y rendimiento en PDF.
            </p>
          </div>

        </div>
      </section>

      {/* --- MANIFESTO --- */}
      <section id="manifesto" className="py-12 px-6 bg-[#0B1021] relative overflow-hidden scroll-mt-32">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-1/2 right-1/4 translate-y-1/2 w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center space-x-3 mb-6">
            <div className="h-px w-6 bg-indigo-500/50"></div>
            <span className="text-indigo-400 font-bold tracking-[0.4em] uppercase text-[9px]">El Manifiesto</span>
            <div className="h-px w-6 bg-indigo-500/50"></div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg md:text-2xl font-light leading-snug text-gray-200">
              <Typewriter text="El liderazgo es solitario." startDelay={500} /> <br />
              <Typewriter text="A medida que subes, la verdad escasea." startDelay={2500} />
            </h3>

            <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-xl mx-auto">
              <Typewriter text="Tu equipo te dice lo que quieres oír. Tu familia no entiende la presión." startDelay={5500} delay={30} /> <br />
              <strong className="text-white font-semibold">
                <Typewriter text="Tu mente se llena de ruido." startDelay={9500} />
              </strong>
            </p>

            <div className="py-4">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent mx-auto"></div>
            </div>

            <p className="text-base md:text-xl font-light text-gray-300">
              <Typewriter text="No construimos Blackbox para que te sientas 'bien'." startDelay={11500} /> <br />
              <Typewriter text="Lo construimos para que " startDelay={15000} />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 font-bold">
                <Typewriter text="pienses claro." startDelay={16500} />
              </span>
            </p>

            <div className="pt-4">
              <p className="text-sm md:text-lg text-white font-medium italic leading-relaxed max-w-xl mx-auto opacity-90">
                <Typewriter text='"Blackbox es tu espejo honesto. El lugar donde eres vulnerable para volverte tácticamente invencible."' startDelay={18500} delay={40} />
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- VIDEO SECTION --- */}
      <section id="demo" className="py-24 bg-[#0F1426] border-y border-white/5 scroll-mt-32">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-12">Tu mente, auditada en <span className="text-indigo-400">15 segundos</span>.</h2>

          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl mx-auto max-w-4xl group">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
            >
              <source src="/assets/Video_Generado_Opción_.mp4" type="video/mp4" />
              Tu navegador no soporta videos.
            </video>

            <div className="absolute bottom-6 left-6 text-left pointer-events-none">
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">Demo Reel</div>
              <div className="text-xl font-bold">Detector de Sesgos en Tiempo Real</div>
            </div>
          </div>
        </div>
      </section>

      {/* --- TESTIMONIOS --- */}
      <section id="testimonios" className="py-24 px-6 bg-[#0B1021] relative overflow-hidden scroll-mt-32">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <div className="inline-flex items-center space-x-3 mb-6">
              <div className="h-px w-6 bg-indigo-500/50"></div>
              <span className="text-indigo-400 font-bold tracking-[0.4em] uppercase text-[9px]">Lo dicen ellos</span>
              <div className="h-px w-6 bg-indigo-500/50"></div>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">No es teoría. Es un director real.</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Cita limpia */}
            <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/5 rounded-[2rem] p-8 md:p-10">
              <p className="text-lg md:text-2xl font-light leading-relaxed text-gray-200">
                “Mientras cenamos en la noche, mi esposa me cuenta algo importante sobre su día; treinta segundos después ya no me acuerdo de qué me dijo. Eso es pura saturación mental.{' '}
                <span className="text-white font-semibold">BlackBox Mind me pareció brutal: me ayuda a ver todo lo que cargo</span> antes de que me lo cobre la vida.”
              </p>
              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-white/5">
                <div className="w-11 h-11 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold">
                  JS
                </div>
                <div>
                  <div className="font-bold text-white">Juan Sebastián Muñoz Botero</div>
                  <div className="text-sm text-gray-400">Business Director · Grupo Vanti</div>
                </div>
              </div>
            </div>

            {/* Captura original (prueba social) */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl border border-white/10 bg-[#151B33] p-2 shadow-2xl shadow-indigo-900/30">
                <img
                  src="/assets/testimonio-jsmunoz.png"
                  alt="Recomendación de Juan Sebastián Muñoz Botero en LinkedIn"
                  className="w-full h-auto rounded-xl"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-3 -right-3 bg-[#0B1021] border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
                Publicado en LinkedIn
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA / DOWNLOAD --- */}
      <section id="cta" className="py-24 px-6">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#151B33] to-[#0B1021] rounded-[3rem] p-12 md:p-20 text-center border border-white/5 shadow-2xl relative overflow-hidden group">

          <h2 className="text-3xl md:text-5xl font-bold mb-6">Únete a la Beta Privada.</h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
            Acceso exclusivo para fundadores y ejecutivos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#hero" className="bg-white text-[#0B1021] font-bold px-8 py-4 rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center shadow-lg shadow-white/10 hover:scale-105 transform duration-200">
              <img src="/assets/logo-v3.png" alt="Icon" className="w-5 h-5 mr-2" />
              Solicitar iOS
            </a>
            <a href="#hero" className="bg-[#0B1021] text-white border border-white/20 font-bold px-8 py-4 rounded-xl hover:bg-black hover:border-indigo-500/50 transition-all flex items-center justify-center hover:scale-105 transform duration-200">
              <img src="/assets/logo-v3.png" alt="Icon" className="w-5 h-5 mr-2" />
              Solicitar Android
            </a>
          </div>
          <p className="mt-6 text-xs text-indigo-400/60 font-mono">Build v1.1.0-DIAG (F&F)</p>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 px-6 border-t border-white/5 text-center text-gray-500 text-sm bg-[#0B1021]">
        <div className="flex justify-center items-center mb-4 opacity-50">
          <img src="/assets/logo-v3.png" alt="Blackbox Mind Logo" className="h-8 w-auto" />
        </div>
        <p>&copy; {new Date().getFullYear()} Blackbox AI. Todos los derechos reservados.</p>
        <div className="flex justify-center items-center space-x-6 mt-4 font-medium transition-all text-[11px] md:text-sm">
          <Link to="/privacy" className="hover:text-white transition-colors">Privacidad</Link>
          <div className="w-px h-3 bg-white/10"></div>
          <Link to="/terms" className="hover:text-white transition-colors">Términos</Link>
          <div className="w-px h-3 bg-white/10"></div>
          <a href="#" className="hover:text-white transition-colors">Contacto</a>
        </div>
      </footer>

    </div>
  );
}

import AdminLogin from './components/AdminLogin';
import InviteManager from './components/InviteManager';
import SupportManager from './components/SupportManager';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/login" element={<AdminLogin />} />

        {/* Rutas de Administración / Command Center */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="invites" element={<InviteManager />} />
                  <Route path="support" element={<SupportManager />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
