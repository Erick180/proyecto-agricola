/**
 * Script principal para el TaxoMapa Interactivo.
 * Carga los datos taxonómicos de un archivo JSON y renderiza la visualización
 * interactiva utilizando D3.js.
 * * VERSIÓN CORREGIDA Y ROBUSTA
 */
document.addEventListener('DOMContentLoaded', async function () {

    // --- CARGA DE DATOS ---
    try {
        const response = await fetch('data/taxonomia.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const taxoData = await response.json();
        initializeMap(taxoData);
    } catch (error) {
        console.error("Error al cargar los datos taxonómicos:", error);
        document.body.innerHTML = `<div class="w-screen h-screen flex items-center justify-center bg-red-100 text-red-800"><div class="text-center p-4"><h1 class="text-2xl font-bold">Error al Cargar el Mapa</h1><p class="mt-2">No se pudo cargar 'data/taxonomia.json'.</p><p class="mt-1 text-sm">Asegúrate de que el archivo exista en esa ruta y que ejecutas el proyecto desde un servidor local.</p></div></div>`;
    }

    // --- FUNCIÓN DE INICIALIZACIÓN ---
    function initializeMap(taxoData) {
        const svg = d3.select("#mind-map-svg");
        const width = svg.node().getBoundingClientRect().width;
        const height = svg.node().getBoundingClientRect().height;
        const g = svg.append("g");
        
        const levels = ["Reino", "Filo", "Clase", "Agrupación", "Orden"];
        const colors = ["#4A90E2", "#50E3C2", "#F5A623", "#8B5CF6", "#D0021B"];
        const colorScale = d3.scaleOrdinal().domain(levels).range(colors);

        const legendContainer = d3.select("#legend");
        levels.forEach((level, i) => {
            const legendItem = legendContainer.append("div").attr("class", "flex items-center legend-item");
            legendItem.append("div").attr("class", "w-3 h-3 rounded-full mr-2").style("background-color", colors[i]);
            legendItem.append("span").text(level);
        });

        // --- INICIO DE CORRECCIONES CLAVE ---

        // 1. Se crea un generador de links y se configura para que entienda nuestro layout horizontal.
        //    Le decimos que la coordenada X (horizontal) está en la propiedad '.y' de los datos,
        //    y la coordenada Y (vertical) está en la propiedad '.x'.
        const linkGenerator = d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x);

        const treeLayout = d3.tree().size([height, width - 450]); 
        let root = d3.hierarchy(taxoData, d => d.children);
        
        // 2. Se define la posición inicial (x0, y0) del nodo raíz ANTES de cualquier renderizado.
        //    Esto soluciona el error 'NaN' porque le da a la animación inicial un punto de origen.
        root.x0 = height / 2;
        root.y0 = 0;
        
        // --- FIN DE CORRECCIONES CLAVE ---

        let i = 0;
        const duration = 600;

        // Colapsar todos los nodos hijos al inicio
        root.descendants().forEach(d => {
            d._children = d.children;
            if (d.depth > 0) {
              d.children = null;
            }
        });
        
        update(root);

        function collapse(d) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            }
        }

        function expand(d) {
            if (d._children) {
                d.children = d._children;
                d._children = null;
            }
        }
        
        function expandAll(d) {
            if (d._children) {
                d.children = d._children;
                d.children.forEach(expandAll);
                d._children = null;
            } else if (d.children) {
                d.children.forEach(expandAll);
            }
        }

        const tooltip = d3.select("#tooltip");

        function update(source) {
            const treeData = treeLayout(root);
            const nodes = treeData.descendants();
            const links = treeData.links(); // Usar .links() es más directo que .descendants().slice(1)
            
            nodes.forEach(d => { d.y = d.depth * 240 });

            // --- NODOS ---
            const node = g.selectAll("g.node").data(nodes, d => d.id || (d.id = ++i));
            
            const nodeEnter = node.enter().append("g")
                .attr("class", "node")
                .attr("transform", `translate(${source.y0},${source.x0})`)
                .on("click", click);

            nodeEnter.on("mouseover", (event, d) => {
                if (d.data.tooltipText) {
                    tooltip.style("opacity", 1)
                           .html(d.data.tooltipText)
                           .style("left", (event.pageX + 15) + "px")
                           .style("top", (event.pageY - 28) + "px");
                }
            }).on("mouseout", () => tooltip.style("opacity", 0));

            nodeEnter.append("circle")
                .attr("r", 1e-6)
                .style("fill", d => d._children ? colorScale(d.data.level) : "#fff")
                .style("stroke", d => colorScale(d.data.level));
            
            nodeEnter.append("text").attr("class", "icon").attr("dy", "0.05em").text(d => d.data.icon || '');
            
            nodeEnter.append("text")
                .attr("dy", ".35em")
                .attr("x", d => d.children || d._children ? -20 : 20)
                .attr("text-anchor", d => d.children || d._children ? "end" : "start")
                .text(d => d.data.commonName);

            const nodeUpdate = nodeEnter.merge(node);
            
            nodeUpdate.transition().duration(duration)
                .attr("transform", d => `translate(${d.y},${d.x})`);

            nodeUpdate.select("circle").attr("r", 14)
                .style("fill", d => d._children ? colorScale(d.data.level) : "#fff");

            const nodeExit = node.exit().transition().duration(duration)
                .attr("transform", `translate(${source.y},${source.x})`).remove();
            nodeExit.select("circle").attr("r", 1e-6);
            nodeExit.selectAll("text").style("fill-opacity", 1e-6);

            // --- LINKS ---
            const link = g.selectAll("path.link").data(links, d => d.target.id);
            
            // Se usa el 'linkGenerator' configurado
            const linkEnter = link.enter().insert("path", "g")
                .attr("class", "link")
                .attr("d", () => {
                    const o = {x: source.x0, y: source.y0};
                    return linkGenerator({source: o, target: o});
                });

            const linkUpdate = linkEnter.merge(link);
            
            linkUpdate.transition().duration(duration)
                .attr("d", linkGenerator); // Se pasa el generador directamente
            
            link.exit().transition().duration(duration)
                .attr("d", () => {
                    const o = {x: source.x, y: source.y};
                    return linkGenerator({source: o, target: o});
                }).remove();

            // Guardar las posiciones antiguas para la siguiente transición.
            nodes.forEach(d => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        const zoomBehavior = d3.zoom().on("zoom", (event) => g.attr("transform", event.transform));
        svg.call(zoomBehavior);
        const initialTransform = d3.zoomIdentity.translate(100, height / 2).scale(0.7);
        svg.call(zoomBehavior.transform, initialTransform);

        function click(event, d) {
            g.selectAll('.node').classed('selected', false);
            d3.select(event.currentTarget).classed('selected', true);
            
            if (d.children) { // Si tiene hijos visibles, colapsarlos
                collapse(d);
            } else { // Si no tiene hijos visibles (están en _children), expandirlos
                expand(d);
            }
            update(d);
            showInfoPanel(d);
        }
        
        const infoPanel = document.getElementById('info-panel');
        const infoContent = document.getElementById('panel-content-inner');
        const closePanelBtn = document.getElementById('close-panel-btn');
        const homeBtn = document.getElementById('home-btn');
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const expandBtn = document.getElementById('expand-btn');
        const collapseBtn = document.getElementById('collapse-btn');
        const darkModeToggle = document.getElementById('dark-mode-toggle');

        closePanelBtn.addEventListener('click', () => infoPanel.classList.remove('open'));
        homeBtn.addEventListener('click', () => {
            root.descendants().forEach(d => {
                if (d.depth > 0) collapse(d);
            });
            update(root);
            centerNode(root);
            infoPanel.classList.remove('open');
        });
        zoomInBtn.addEventListener('click', () => svg.transition().duration(750).call(zoomBehavior.scaleBy, 1.2));
        zoomOutBtn.addEventListener('click', () => svg.transition().duration(750).call(zoomBehavior.scaleBy, 0.8));
        expandBtn.addEventListener('click', () => { expandAll(root); update(root); });
        collapseBtn.addEventListener('click', () => { root.children.forEach(collapse); update(root); });
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            document.getElementById('theme-icon-sun').classList.toggle('hidden');
            document.getElementById('theme-icon-moon').classList.toggle('hidden');
        });

        function showInfoPanel(d) {
            const data = d.data;
            infoContent.innerHTML = `
                <div class="mb-4">
                    <span class="text-sm font-semibold py-1 px-3 rounded-full text-white" style="background-color: ${colorScale(data.level)}">${data.level}</span>
                </div>
                <h3 class="text-3xl font-bold mb-1">${data.commonName} <span class="text-2xl">${data.icon || ''}</span></h3>
                <p class="text-lg text-gray-500 dark:text-gray-400 italic mb-4">${data.name}</p>
                <div id="image-container" class="my-4">
                    ${data.imagen ? `<img src="${data.imagen}" alt="Imagen de ${data.commonName}" class="w-full h-auto rounded-lg shadow-md object-cover" onerror="this.style.display='none'">` : ''}
                </div>
                <div class="mt-4 pt-4 border-t dark:border-gray-700">
                    <h4 class="font-bold text-xl mb-2">Descripción</h4>
                    <p class="leading-relaxed">${data.description || "No hay descripción disponible."}</p>
                </div>
                ${data.agriculturalImportance ? `<div class="mt-4 pt-4 border-t dark:border-gray-700">
                    <h4 class="font-bold text-xl mb-2 flex items-center"><span class="text-2xl mr-2">🌾</span>Importancia Agrícola</h4>
                    <p>${data.agriculturalImportance}</p>
                </div>` : ''}
                ${data.funFact ? `<div class="mt-6 pt-4 border-t border-dashed dark:border-gray-600">
                    <h4 class="font-bold text-xl mb-3 flex items-center">
                        <span class="text-2xl mr-2">💡</span>Dato Curioso
                    </h4>
                    <div id="fun-fact-result" class="p-4 bg-blue-50 dark:bg-gray-700 rounded-lg">
                       <p class="text-sm text-gray-800 dark:text-gray-200">${data.funFact}</p>
                    </div>
                </div>` : ''}
            `;
            infoPanel.classList.add('open');
        }

        function centerNode(source) {
            setTimeout(() => {
                const t = d3.zoomTransform(svg.node());
                const x = -source.y0 * t.k + (width / 2) - 200; 
                const y = -source.x0 * t.k + height / 2;
                svg.transition().duration(750).call(zoomBehavior.transform, d3.zoomIdentity.translate(x, y).scale(t.k));
            }, duration);
        }
    }
});
