const svg = d3.select("#us_map");
const width = svg.attr("width");
const height = svg.attr("height");
const margin = { top: 10, right: 10, bottom: 10, left: 10 };
const mapWidth = width - margin.left - margin.right;
const mapHeight = height - margin.top - margin.bottom;
const map = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

const state_svg = d3.select("#state_map");
const state_width = state_svg.attr("width");
const state_height = state_svg.attr("height");
const state_margin = { top: 10, right: 10, bottom: 50, left: 50 };
const chartWidth = width - state_margin.left - state_margin.right;
const chartHeight = height - state_margin.top - state_margin.bottom;
let annotations = state_svg.append("g").attr("id", "annotations");
let chartArea = state_svg.append("g")
    .attr("id", "points")
    .attr("transform", `translate(${state_margin.left},${state_margin.top})`);

const requestData = async function() {
    const us = await d3.json("../data/us-smaller.json");
    let selected_year = "2016";
    let selected_state = "AL";
    var states = topojson.feature(us, us.objects.states);
    var statesMesh = topojson.mesh(us, us.objects.states);
    var projection = d3.geoAlbersUsa().fitSize([width, height], states);
    var path = d3.geoPath().projection(projection);

    map.selectAll("path.state").data(states.features)
        .join("path")
        .attr("class", "state")
        .attr("note", d => d.id)
        .attr("d", path);

    map.append("path").datum(statesMesh)
        .attr("class", "outline")
        .attr("stroke-width", 1)
        .attr("stroke", "white")
        .attr("d", path);

    const listings = await d3.json("../data/listings.json");
    var stateIDs = await d3.tsv("../data/us-state-names.tsv");
    let idToState = {}

    stateIDs.forEach(row => {
        idToState[row.id] = row.code;
    });

    let listing_data = {}
    listings.forEach(row => {
        year = row["month_date_yyyymm"].toString().slice(0, 4);
        if (year in listing_data) {
            if (Object.keys(listing_data[year]).includes(row["state_id"])) {
                listing_data[year][row["state_id"].toUpperCase()][0] += row["median_listing_price_per_square_foot"];
                listing_data[year][row["state_id"].toUpperCase()][1] += (row["price_increased_count"] / row["total_listing_count"]) * 100;
                listing_data[year][row["state_id"].toUpperCase()][2] += (row["price_reduced_count"] / row["total_listing_count"]) * 100;
                listing_data[year][row["state_id"].toUpperCase()][3] += 1;
            } else {
                listing_data[year][row["state_id"].toUpperCase()] = [row["median_listing_price_per_square_foot"],
                    (row["price_increased_count"] / row["total_listing_count"]) * 100,
                    (row["price_reduced_count"] / row["total_listing_count"]) * 100, 1
                ]
            }
        } else {
            var state = new Object();
            state[row["state_id"].toUpperCase()] = [row["median_listing_price_per_square_foot"],
                (row["price_increased_count"] / row["total_listing_count"]) * 100,
                (row["price_reduced_count"] / row["total_listing_count"]) * 100, 1
            ]
            listing_data[year] = state;
        }
    })

    let min = Infinity;
    let max = -Infinity;

    Object.values(listing_data).forEach(year => {
        for (const [key, value] of Object.entries(year)) {
            value[0] /= value[3];
            value[1] /= value[3];
            value[2] /= value[3];
            if (value[0] < min) {
                min = value[0]
            } else if (value[0] > max) {
                max = value[0]
            }
        }
    })

    console.log("min", min)
    console.log("max", max)

    function state_added() {
        selected_state = idToState[this.getAttribute("note")];
        let state_data = []
        Object.keys(listing_data).forEach(d => {
            state_data.push(listing_data[d][selected_state][0])
        })

        lineGen = d3.line()
            .x((d, i) => dateScale(Object.keys(listing_data)[i]))
            .y(d => stateScale(d))
            .curve(d3.curveMonotoneX);

        chartArea.append("path")
            .datum(state_data)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "#dd403a")
            .attr("stroke-width", 3)
            .attr("opacity", 0.6)
            .attr("id", selected_state + "_" + selected_year)
            .attr("d", lineGen);

        let id = selected_state + "_" + selected_year;
        let span = document.createElement("span");
        span.innerHTML = "<p>" + id + "</p>";
        span.id = id;
        document.body.appendChild(span);
        span.translate(10, 10);
    }

    d3.selectAll(".state").on("click", state_added);
    d3.select("#clear_button").on("click", function() {
        d3.selectAll("path.line").remove();
        d3.selectAll("span").remove();
    })

    let stateScale = d3.scaleLinear().domain([0, max]).range([chartHeight, 0]);
    const dateExtent = d3.extent(Object.keys(listing_data));
    const dateScale = d3.scaleLinear().domain(dateExtent).range([0, chartWidth]);
    let leftAxis = d3.axisLeft(stateScale)
    let leftGridlines = d3.axisLeft(stateScale)
        .tickSize(-chartWidth - 10)
        .tickFormat(d3.format("$d"))
    annotations.append("g")
        .attr("class", "y gridlines")
        .attr("transform", `translate(${state_margin.left-10},${state_margin.top})`)
        .call(leftGridlines);

    let bottomAxis = d3.axisBottom(dateScale)
    let bottomGridlines = d3.axisBottom(dateScale)
        .ticks(6)
        .tickSize(-chartHeight - 10)
        .tickFormat(d3.format("d"));
    annotations.append("g")
        .attr("class", "x gridlines")
        .attr("transform", `translate(${state_margin.left},${chartHeight+state_margin.top+10})`)
        .call(bottomGridlines);

    let year_filter = d3.select("#year-select");
    Object.keys(listing_data).forEach(d => {
        let element = document.getElementById("year-select")
        let select = document.createElement("option");
        select.value = d;
        let node = document.createTextNode(d);
        select.appendChild(node);
        element.appendChild(select);
    })

    year_filter.on("change", function() {
        var legendSvg = d3.select("#colorLegend");
        legendSvg.selectAll("*").remove();
        selected_year = this.value;

        var dataFilter = listing_data[selected_year];

        // minMax = d3.extent(Object.values(listing_data[selected_year]), d => d[0]);
        colorScale = d3.scaleQuantile()
            .domain([min, max])
            .range(["#f7b267", "#ff8a5b", "#f25c54", "#dd403a", "#a6003e"]);

        map.selectAll(".state")
            .transition()
            .duration(1500)
            .style("fill", d => {
                if (typeof(listing_data[selected_year][idToState[d.id]]) == "undefined") {
                    listing_data[selected_year][idToState[d.id]] = [];
                }
                return colorScale(listing_data[selected_year][idToState[d.id]][0]);
            });
        drawLegend(d3.select("#colorLegend"), colorScale);
    })

    // let minMax = d3.extent(Object.values(listing_data[selected_year]), d => d[0]);

    let colorScale = d3.scaleQuantile()
        // .domain(minMax)
        .domain([min, max])
        .range(["#f7b267", "#ff8a5b", "#f25c54", "#dd403a", "#a6003e"]);

    map.selectAll(".state")
        .attr("state", d => (listing_data[selected_year][idToState[d.id]]))
        .style("fill", d => {
            if (typeof(listing_data[selected_year][idToState[d.id]]) == "undefined") {
                listing_data[selected_year][idToState[d.id]] = [];
            }
            return colorScale(listing_data[selected_year][idToState[d.id]][0]);
        });

    drawLegend(d3.select("#colorLegend"), colorScale)

    let tooltipWidth = 140;
    let tooltipHeight = 80;
    let tooltip = map.append("g")
        .attr("class", "tool")
        .attr("visibility", "visible");

    tooltip.append("rect")
        .attr("fill", "white")
        .attr("opacity", 0.9)
        .attr("x", -tooltipWidth / 2.0)
        .attr("y", 0)
        .attr("width", tooltipWidth)
        .attr("height", tooltipHeight)
        .attr("rx", 6)
        .attr("ry", 6)

    let txt = tooltip.append("text")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "hanging")
        .attr("x", 0)
        .attr("y", 2);

    let txt2 = tooltip.append("text")
        .attr("fill", "black")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "hanging")
        .attr("x", 0)
        .attr("y", 22);

    let txt3 = tooltip.append("text")
        .attr("fill", "blue")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "hanging")
        .attr("x", 0)
        .attr("y", 42);

    let txt4 = tooltip.append("text")
        .attr("fill", "red")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "hanging")
        .attr("x", 0)
        .attr("y", 62);

    let mesh = map.append("path")
        .attr("class", "mouseover outline")
        .attr("d", "");

    d3.selectAll(".state").on("mouseenter", mouseEntersPlot).attr('cursor', 'pointer');
    d3.selectAll(".state").on("mouseout", mouseLeavesPlot);

    function mouseEntersPlot() {
        tooltip.style("visibility", "visible")
        let state = d3.select(this);
        let stateID = state.datum().id;

        var mo = topojson.mesh(us, us.objects.states, function(a, b) { return a.id === stateID || b.id === stateID; });
        mesh.datum(mo).attr("d", path);

        txt.text(idToState[stateID]);
        txt2.text("$" + listing_data[selected_year][idToState[stateID]][0].toFixed(2) + "/sq ft");
        txt3.text(listing_data[selected_year][idToState[stateID]][1].toFixed(2) + "% increase");
        txt4.text(listing_data[selected_year][idToState[stateID]][2].toFixed(2) + "% decrease");

        let bounds = path.bounds(state.datum());
        let xPos = (bounds[0][0] + bounds[1][0]) / 2.0;
        let yPos = bounds[1][1];

        tooltip.attr("transform", `translate(${xPos},${yPos})`);
    }

    function mouseLeavesPlot() {
        tooltip.style("visibility", "hidden");
        mesh.attr("d", "");
    }

    function drawLegend(legend, legendColorScale) {
        //const legend = d3.select("#colorLegend");
        const legendWidth = legend.attr("width");
        const legendHeight = legend.attr("height");
        const legendMinMax = d3.extent(legendColorScale.domain());
        const barHeight = 30;
        const pixelScale = d3.scaleLinear().domain([0, legendWidth - (legendWidth / 5)]).range([legendMinMax[0] - 1, legendMinMax[1] + 1]); // In this case the "data" are pixels, and we get numbers to use in colorScale
        const barScale = d3.scaleLinear().domain([legendMinMax[0] - 1, legendMinMax[1] + 1]).range([0, legendWidth]);
        const barAxis = d3.axisBottom(barScale);
        if (legendColorScale.hasOwnProperty('quantiles')) {
            barAxis.tickValues(legendColorScale.quantiles().concat(legendMinMax)).tickSize(10).tickFormat(function(d, i) {
                return "$" + Math.round(d) + "/sq ft";
            });
        }
        legend.append("g")
            .attr("class", "colorbar axis")
            .attr("transform", "translate(" + (20) + "," + (barHeight + 5) + ")")
            .call(barAxis);
        let bar = legend.append("g").attr("transform", "translate(" + (20) + "," + (0) + ")")
        for (let i = 0; i < legendWidth; i = (i + legendWidth / 5)) {
            bar.append("rect").attr("x", i).attr("y", 0).attr("width", legendWidth / 5).attr("height", barHeight).style("fill", legendColorScale(pixelScale(i)));
        }
    }
}
requestData();