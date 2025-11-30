document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('trip-form');
    const resultsSection = document.getElementById('results');
    const itinerariesGrid = document.getElementById('itineraries-grid');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');

    // Data Persistence: Fetch from database.json with Inline Fallback
    // Initializing with fallback data to ensure app works even if fetch fails (e.g. CORS on local file)
    let mockData = {
        nature: {
            titles: ["Ecoturismo na Mata Atlântica", "Expedição Amazônia Selvagem", "Paraíso no Cerrado"],
            activities: ["Trilha das Cachoeiras", "Observação de Araras Azuis", "Banho de Rio Cristalino"],
            accommodations: ["Pousada Recanto das Águas", "Eco-Lodge Toca do Tatu", "Refúgio da Serra"]
        },
        culture: {
            titles: ["Imersão no Pelourinho", "Rota do Ouro Colonial", "Tradições do Sertão"],
            activities: ["Oficina de Capoeira", "Visita a Quilombos", "Degustação de Cachaça Artesanal"],
            accommodations: ["Pousada Casarão Histórico", "Hostel Cultural Raízes", "Hotel Boutique Colonial"]
        },
        gastronomy: {
            titles: ["Sabores do Norte", "Rota do Vinho Gaúcho", "Delícias Mineiras"],
            activities: ["Aula de Culinária Regional", "Colheita de Café Especial", "Jantar em Fazenda Histórica"],
            accommodations: ["Pousada do Vinhedo", "Hotel Fazenda Café", "Estalagem Gastronômica"]
        },
        relaxation: {
            titles: ["Detox em Alto Paraíso", "Retiro na Chapada", "Spa Natural em Bonito"],
            activities: ["Yoga ao Amanhecer", "Massagem com Pedras Quentes", "Banho de Argila Natural"],
            accommodations: ["Resort Zen Chapada", "Bangalôs do Rio", "Santuário Ecológico Spa"]
        }
    };

    async function loadDatabase() {
        try {
            const response = await fetch('database.json');
            if (response.ok) {
                mockData = await response.json();
                console.log("Database loaded successfully");
            }
        } catch (error) {
            console.warn("Could not load external database (likely CORS or offline). Using internal fallback data.", error);
        }
    }

    loadDatabase();


    // Autocomplete Logic
    const destinationInput = document.getElementById('destination');
    const suggestionsList = document.getElementById('suggestions-list');
    let debounceTimer;

    destinationInput.addEventListener('input', (e) => {
        const query = e.target.value;
        clearTimeout(debounceTimer);

        if (query.length < 3) {
            suggestionsList.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await response.json();

                suggestionsList.innerHTML = '';

                if (data.length > 0) {
                    suggestionsList.classList.remove('hidden');
                    data.forEach(place => {
                        const li = document.createElement('li');
                        li.textContent = place.display_name;
                        li.addEventListener('click', () => {
                            destinationInput.value = place.display_name;
                            suggestionsList.classList.add('hidden');
                        });
                        suggestionsList.appendChild(li);
                    });
                } else {
                    suggestionsList.classList.add('hidden');
                }
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        }, 300); // 300ms debounce
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!destinationInput.contains(e.target) && !suggestionsList.contains(e.target)) {
            suggestionsList.classList.add('hidden');
        }
    });

    let map = null;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check if user is logged in and has premium subscription
        const user = auth.getCurrentUser();

        if (!user) {
            alert('Você precisa fazer login para criar roteiros.\n\nCrie sua conta e assine o Plano Premium para ter acesso ilimitado!');
            window.location.href = 'cadastro.html';
            return;
        }

        if (!auth.isPremiumUser()) {
            alert('Apenas assinantes Premium podem criar roteiros!\n\nAssine agora por apenas R$ 19,90/mês e tenha acesso ilimitado.');
            // Scroll to pricing section
            const pricingSection = document.getElementById('pricing');
            if (pricingSection) {
                pricingSection.scrollIntoView({ behavior: 'smooth' });
            }
            return;
        }

        // UI Loading State
        const submitBtn = form.querySelector('button');
        submitBtn.disabled = true;
        btnText.textContent = "Analisando Rotas...";
        loader.classList.remove('hidden');
        resultsSection.classList.add('hidden');

        // Get Form Values
        const destination = document.getElementById('destination').value;
        const date = document.getElementById('dates').value;
        const theme = document.getElementById('theme').value;

        let lat = null;
        let lon = null;

        try {
            // Geocoding with Nominatim (OpenStreetMap) - Soft Fail
            try {
                const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`);
                const geoData = await geoResponse.json();

                if (geoData.length > 0) {
                    lat = parseFloat(geoData[0].lat);
                    lon = parseFloat(geoData[0].lon);
                } else {
                    console.warn("Destination coordinates not found. Proceeding without map update.");
                }
            } catch (geoError) {
                console.warn("Geocoding service unavailable. Proceeding without map update.", geoError);
            }

            // Simulate AI Processing Delay (1.5s)
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Generate Itineraries (Always runs, even if geocoding fails)
            const itineraries = generateItineraries(destination, theme);

            // Render Results
            renderItineraries(itineraries);

            // Reset UI
            submitBtn.disabled = false;
            btnText.textContent = "Gerar Roteiros com IA";
            loader.classList.add('hidden');
            resultsSection.classList.remove('hidden');

            // Initialize/Update Map ONLY if coordinates were found
            if (lat && lon) {
                if (map) {
                    map.remove();
                }
                map = L.map('map').setView([lat, lon], 12);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);

                // Add markers for each itinerary (simulating slightly different locations around the center)
                itineraries.forEach((itinerary, index) => {
                    // Random offset to simulate different locations
                    const offsetLat = (Math.random() - 0.5) * 0.05;
                    const offsetLon = (Math.random() - 0.5) * 0.05;

                    L.marker([lat + offsetLat, lon + offsetLon])
                        .addTo(map)
                        .bindPopup(`<b>${itinerary.title}</b><br>${itinerary.accommodation}`);
                });
            } else {
                // Hide map if no coordinates
                const mapContainer = document.getElementById('map');
                if (mapContainer) mapContainer.style.display = 'none';
            }

            // Smooth scroll to results
            resultsSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error("Critical error generating itineraries:", error);
            alert("Ocorreu um erro ao gerar seus roteiros. Por favor, tente novamente.");
            submitBtn.disabled = false;
            btnText.textContent = "Gerar Roteiros com IA";
            loader.classList.add('hidden');
        }
    });

    function generateItineraries(destination, theme) {
        const themeData = mockData[theme] || mockData.nature;
        const results = [];

        // Generate 3 variations
        for (let i = 0; i < 3; i++) {
            const ecoScore = calculateEcoScore(i); // 0=High, 1=Medium, 2=Low (just for demo variety)
            const rating = (4.5 + Math.random() * 0.5).toFixed(1); // Random rating between 4.5 and 5.0

            results.push({
                id: i,
                title: `${themeData.titles[i]} em ${destination}`,
                duration: "5 Dias",
                price: `R$ ${1500 + (i * 300)}`,
                rating: rating,
                accommodation: themeData.accommodations[i],
                // Use LoremFlickr for reliable keyword-based images. Adding random param to prevent caching same image.
                // Appending 'Brazil' to ensure we get Brazilian-looking landscapes and hotels
                image: `https://loremflickr.com/800/600/${encodeURIComponent(destination)},Brazil,landscape/all?lock=${i}`,
                accommodationImage: `https://loremflickr.com/800/600/pousada,hotel,Brazil,${encodeURIComponent(theme)}/all?lock=${i + 10}`,
                highlights: [
                    themeData.activities[0],
                    themeData.activities[1],
                    themeData.activities[2]
                ]
            });
        }
        return results;
    }

    function calculateEcoScore(index) {
        // Deterministic mock logic for demo
        if (index === 0) return { label: "Alto Impacto Positivo", class: "high", icon: "🌿" };
        if (index === 1) return { label: "Médio Impacto", class: "medium", icon: "⚠️" };
        return { label: "Baixo Impacto", class: "low", icon: "🛑" };
    }

    function renderItineraries(itineraries) {
        itinerariesGrid.innerHTML = itineraries.map(itinerary => `
            <div class="itinerary-card">
                <div class="card-header">
                    <img src="${itinerary.image}" alt="${itinerary.title}" class="card-img" onerror="this.src='https://placehold.co/800x600?text=EcoPilot'">
                </div>
                <div class="card-body">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <h3 class="card-title" style="margin-bottom: 0;">${itinerary.title}</h3>
                        <div class="rating" style="color: #F59E0B; font-weight: 700; display: flex; align-items: center; gap: 0.25rem;">
                            <span>⭐</span> ${itinerary.rating}
                        </div>
                    </div>
                    
                    <div class="card-meta">
                        <span>📅 ${itinerary.duration}</span>
                        <span>💰 ${itinerary.price}</span>
                    </div>

                    <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
                        <a href="hospedagem.html?name=${encodeURIComponent(itinerary.accommodation)}&image=${encodeURIComponent(itinerary.accommodationImage)}&rating=${itinerary.rating}&location=${encodeURIComponent(itinerary.title)}" target="_blank">
                            <img src="${itinerary.accommodationImage}" alt="Hotel" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                        </a>
                        <div>
                            <a href="hospedagem.html?name=${encodeURIComponent(itinerary.accommodation)}&image=${encodeURIComponent(itinerary.accommodationImage)}&rating=${itinerary.rating}&location=${encodeURIComponent(itinerary.title)}" target="_blank" style="text-decoration: none;">
                                <p style="font-size: 0.9rem; font-weight: 600; color: var(--color-navy); margin-bottom: 0;">${itinerary.accommodation}</p>
                            </a>
                            <p style="font-size: 0.8rem; color: var(--color-gray-500); margin-top: 0;">Hospedagem Selecionada</p>
                        </div>
                    </div>

                    <div class="card-highlights">
                        <h4>Destaques:</h4>
                        <ul>
                            ${itinerary.highlights.map(h => `<li>${h}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="card-footer">
                        <a href="hospedagem.html?name=${encodeURIComponent(itinerary.accommodation)}&image=${encodeURIComponent(itinerary.accommodationImage)}&rating=${itinerary.rating}&location=${encodeURIComponent(itinerary.title)}" class="btn btn-primary" style="text-decoration: none; width: 100%;">Ver Detalhes</a>
                    </div>
                </div>
            </div>
        `).join('');
    }
});
