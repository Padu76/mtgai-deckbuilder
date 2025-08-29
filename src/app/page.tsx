// src/app/page.tsx
import Link from 'next/link'

export default function HomePage() {
  const quickActions = [
    {
      title: 'AI Combo Builder',
      description: 'L\'AI trova tutte le combo per i tuoi colori',
      icon: '🧠',
      color: 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500',
      href: '/combo-builder',
      featured: true
    },
    {
      title: 'Builder Standard',
      description: 'Crea deck Standard competitivi',
      icon: '⚔️',
      color: 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500',
      href: '/build/standard'
    },
    {
      title: 'Builder Brawl',
      description: 'Mazzi singleton con comandante',
      icon: '👑',
      color: 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500',
      href: '/build/brawl'
    }
  ]

  const features = [
    {
      icon: '🔍',
      title: 'Analisi AI Avanzata',
      description: 'L\'intelligenza artificiale analizza migliaia di carte per trovare sinergie nascoste e combo potenti'
    },
    {
      icon: '⚡',
      title: 'Combo Infinite',
      description: 'Trova automaticamente combo infinite, engine di valore e win condition ottimali'
    },
    {
      icon: '🎯',
      title: 'Ottimizzazione Meta',
      description: 'Deck bilanciati e competitivi, pronti per l\'import diretto in MTG Arena'
    },
    {
      icon: '📊',
      title: 'Curve Perfette',
      description: 'Analisi automatica di mana curve, sinergie e ratios per massima consistenza'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center font-bold text-white text-xl">
                M
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">MTG AI Deckbuilder</h1>
                <p className="text-sm text-gray-400">Powered by Artificial Intelligence</p>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/combo-builder" className="text-gray-300 hover:text-white transition-colors flex items-center space-x-1 bg-purple-600/20 px-3 py-2 rounded-lg border border-purple-500/30">
                <span>🧠</span>
                <span>AI Combo Builder</span>
              </Link>
              <Link href="/build/standard" className="text-gray-300 hover:text-white transition-colors">Standard</Link>
              <Link href="/build/brawl" className="text-gray-300 hover:text-white transition-colors">Brawl</Link>
              <Link href="/admin" className="text-gray-300 hover:text-white transition-colors">Admin</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/10 via-transparent to-blue-900/10" />
        <div className="relative max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <h2 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-6">
              AI Deck Builder
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              L'intelligenza artificiale trova automaticamente le migliori combo per i tuoi colori preferiti.
              Sinergie nascoste, curve ottimali, export diretto in MTG Arena.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/combo-builder"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-lg rounded-xl hover:from-purple-500 hover:to-blue-500 transition-all transform hover:scale-105 shadow-2xl"
              >
                <span className="mr-3">🧠</span>
                Trova Combo con AI
              </Link>
              <Link 
                href="/build/standard"
                className="inline-flex items-center px-8 py-4 border-2 border-gray-600 text-gray-300 font-bold text-lg rounded-xl hover:border-gray-500 hover:text-white transition-all"
              >
                Builder Tradizionale
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">Inizia subito</h3>
            <p className="text-gray-300 text-lg">Scegli il tuo approccio al deck building</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {quickActions.map((action, idx) => (
              <Link
                key={idx}
                href={action.href}
                className={`
                  group relative overflow-hidden rounded-2xl p-8 text-center transition-all duration-300 transform hover:scale-105 hover:shadow-2xl
                  ${action.color}
                  ${action.featured ? 'md:col-span-2 md:row-span-1' : ''}
                `}
              >
                <div className="relative z-10">
                  <div className="text-4xl mb-4">{action.icon}</div>
                  <h4 className="text-2xl font-bold text-white mb-3">{action.title}</h4>
                  <p className="text-gray-200 text-lg leading-relaxed">{action.description}</p>
                  
                  {action.featured && (
                    <div className="mt-6 inline-flex items-center px-4 py-2 bg-white/20 rounded-lg text-white font-medium">
                      <span className="mr-2">✨</span>
                      Novità - AI Powered
                    </div>
                  )}
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-gray-800/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">Perché usare l'AI?</h3>
            <p className="text-gray-300 text-lg">L'intelligenza artificiale rivoluziona il deck building</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center text-2xl mb-4 mx-auto group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h4 className="text-xl font-bold text-white mb-3">{feature.title}</h4>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-3xl p-8 border border-gray-700">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
                  50,000+
                </div>
                <div className="text-gray-300">Carte analizzate</div>
              </div>
              <div>
                <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent mb-2">
                  1,000+
                </div>
                <div className="text-gray-300">Combo identificate</div>
              </div>
              <div>
                <div className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                  Arena Ready
                </div>
                <div className="text-gray-300">Export diretto</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-4xl font-bold text-white mb-6">
            Pronto a dominare il meta?
          </h3>
          <p className="text-xl text-gray-300 mb-8">
            Lascia che l'AI trovi le combo più potenti per i tuoi colori preferiti
          </p>
          <Link 
            href="/combo-builder"
            className="inline-flex items-center px-10 py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold text-xl rounded-2xl hover:shadow-2xl transition-all transform hover:scale-105"
          >
            <span className="mr-3">🚀</span>
            Inizia ora con l'AI
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center font-bold text-white">
                  M
                </div>
                <span className="text-gray-300">MTG AI Deckbuilder</span>
              </div>
            </div>
            <div className="flex space-x-6 text-gray-400 text-sm">
              <Link href="/combo-builder" className="hover:text-white transition-colors">AI Builder</Link>
              <Link href="/build/standard" className="hover:text-white transition-colors">Standard</Link>
              <Link href="/build/brawl" className="hover:text-white transition-colors">Brawl</Link>
              <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
            <p>Magic: The Gathering è un marchio di Wizards of the Coast. Non affiliato con Wizards of the Coast.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}