// add event listener for the form
var searchButton = $('#search_button');
searchButton.on('click', validateFormAndSearch);
var movieListLengthLimit = 5;
// this count limit keeps the low popularity/familiarity movies out
var ratingCountLimit = 200;
// this is used to keep track of the currently rendered search object
var currentUserChoiceIndex = -1;
// this is a global list of all search objects
var searchObjectHistory = [];
// the current searchObject
var currentSearchObj = null;
// Loading Bar 
var loading = document.querySelector('.progress')

// loading bar functions
function loadingVisible() {
    loading.style.visibility = 'visible'
}

function loadingHidden() {
    loading.style.visibility = 'hidden'
}

// details for the api queries - currently Ella's second key
apiDetails = {
    "method": "GET",
    "headers": {
        "x-rapidapi-key": "98715f4491msh274d5b66c7dd486p1027f4jsnb2d0b51ad3c4",
        "x-rapidapi-host": "imdb8.p.rapidapi.com"
    }
}

function updateCurrentSearchIndexAndObj(index){
    currentUserChoiceIndex = index;

    if(searchObjectHistory.length > 0){
        currentSearchObj = searchObjectHistory[index];
    } else {
        currentSearchObj = null;
    }
}

// add event handler for body tag onload to load storage and render
window.addEventListener('load', loadAndRenderSearchObjects);

// add event delegation to the search history section for buttons
let searchHistoryEl = $('#search_history');
searchHistoryEl.on('click', '.search_history_button', function (event) {
    event.preventDefault();
    let searchIndexRaw = event.target.dataset['searchIndex'];
    let searchIndexInt = parseInt(searchIndexRaw, 10);
    // using a global
    updateCurrentSearchIndexAndObj(searchIndexInt);
    setActiveButtonToCurrentObject();
    renderCurrentMovieResults();
    renderCurrentMovieActorImages();
})

// function that loads elements from storage
// then calls render on all searchObjects for their buttons
// then calls render on the last searchObject as that was the most recent
function loadAndRenderSearchObjects(){

    loadSearchObjects();
  
    // check there are some
    if(searchObjectHistory.length > 0){
        // the button for the current choice is rendered with the object itself below
        for(let i = 0; i < searchObjectHistory.length; i++){
            updateCurrentSearchIndexAndObj(i);
            // call the render method for the movie cards of the current search object
            renderCurrentSearchObject();
        }
    }
}

// run search
// validating the form details
function validateFormAndSearch(event){
    event.preventDefault();

    let buttonElement = $(event.target);
    let parentForm = buttonElement.parents('form');

    // get the two input fields from the form
    let userInputs = parentForm.children().find('input');

    // get text elements out of strings
    let userInputTexts = [];
    for(let i = 0; i < userInputs.length; i++){
        let userInputEl = userInputs[i];
        let textValue = userInputEl.value;
        // filter out empty strings as they are falsy
        if(textValue){
            userInputTexts.push(textValue);
        }
    }

  
    // check if we have already run this search before and if so, will return the index of the search object, else it will be null
    let duplicateIndex = getDuplicateSearchIndex(userInputTexts);
    if(duplicateIndex < 0){
        // run a new search
        console.log('No duplicates found in history, new api search');

        // loading bar visible
        loadingVisible();

        // build new query strings
        // take all valid user text values, build a query string for IMDB and make array
        let queryStrings = userInputTexts.map((inputText) => {
            let queryString = buildQueryStringForIMDb(inputText);
            return queryString;
        });
        runSearchWithInputValues(queryStrings);
    }else{
        console.log('rendering previous search result: ', duplicateIndex)
        // set the current search object to the object we already have
        updateCurrentSearchIndexAndObj(duplicateIndex)
        // render the object we had in history again
        updateRenderCurrentSearchObject();
    }
}



// Chris's matching function
function getCommonMovieObjects(movieNumberLists){
    let resultMovieList = [];
    let movieNumberList1 = movieNumberLists[0];
    let movieNumberList2 = movieNumberLists[1];

    // two actor case, match up to the specified limit of movies to get more details for
    if(movieNumberList2){
        for(let i = 0; i < movieNumberList1.length; i++){
            for(let j = 0; j < movieNumberList2.length; j++){
                if(movieNumberList2[j] === movieNumberList1[i]){
                    if(resultMovieList.length <= movieListLengthLimit){
                        resultMovieList.push(movieNumberList1[i]);
                    } else {
                        console.log('Movie match overrun of limit: ', movieNumberList1[i], movieListLengthLimit);
                    }
                }
            }
        }
    // single actor case, just set first 5 movies of known for
    }else{
        // if there are too many known for movies, cut to first 5
        if(movieNumberList1.length > movieListLengthLimit){
            resultMovieList = movieNumberList1.slice(0, movieListLengthLimit);
        // otherwise return entire movie list 1
        } else {
            resultMovieList = movieNumberList1;
        }
    }
    
    return resultMovieList;
}

// check the searchObject list we have for the user inputs, if we find them in forwards or backwards order, return the index of the search object
function getDuplicateSearchIndex(inputStringsArray){
    // loop through search objects
    let namesMatched = 0;

    for(let i = 0; i < searchObjectHistory.length; i++){
        let searchObj = searchObjectHistory[i];
        // loop through the two input actor strings
        for(let j = 0 ; j < inputStringsArray.length; j++){
            let inputString = inputStringsArray[j];
            // loop through the actors in each search object
            for(let k = 0; k < searchObj.filters.length; k++){
                let currentActor = searchObj.filters[k];
                if (currentActor.name.toLowerCase() === inputString.toLowerCase()){
                    namesMatched += 1;
                }
            }
            // case where both strings match irrespective of order
            if(namesMatched === inputStringsArray.length){
                // return the search object index that matches the case
                return i;
            }
        }
    }
    // case for no duplicate match, return null
    return -1;

}

// function makes the query string from user input to query the auto-complete endpoint
function buildQueryStringForIMDb(userInput){
    // using IMDb API
    let rootFilmographyApi = "https://imdb8.p.rapidapi.com/auto-complete?q="

    // this trims leading and trailing spaces, and replaces middle spaces with
    // %20 character as required by api
    let encodedUserInput = userInput.replace(/\W/g, "").replace(/[0-9]/g, "");
    encodedUserInput = encodeURIComponent(encodedUserInput.trim());
    let queryString = rootFilmographyApi + encodedUserInput;
    
    return queryString;
}

// function to specify which api endpoint we query filmography or known-for endpoint from
function getFilmographyOrKnownForUrlRoot(actors){
    let queryString = "";
    if(actors.length == 1){
        // query the known for endpoint
         queryString = "https://imdb8.p.rapidapi.com/actors/get-known-for?nconst=";
    } else {
        // query the filmography endpoint
        queryString = "https://imdb8.p.rapidapi.com/actors/get-all-filmography?nconst=";
    }
    return queryString;
}

// fetches the general movie details from a list of movie numbers
async function fetchMovieGeneralDetailsResponse(movieNumberList){

    movieObjectsLists = [];

    // ends with a list of json data from an asynchronous fetch of numerous urls
    movieObjectsLists = await Promise.all(
        // for each actor obj in the list, asynchronously fetch api response, and map the json data
        movieNumberList.map(async movieNumber => {               
            let movieOverviewEndpointUrl = "https://imdb8.p.rapidapi.com/title/get-overview-details?tconst="+movieNumber+"&currentCountry=US";
            let response = await fetch(movieOverviewEndpointUrl, apiDetails);
            let movieJson = await response.json();
            
            // screen the data for necessary fields
            // filter the details down
            try{
                var id = movieJson.id.substring(7,16);
                var title = movieJson.title.title;
                var released = movieJson.title.year;
                var ratingCount = movieJson.ratings.ratingCount;
                var rating = movieJson.ratings.rating;
                var imageUrl = movieJson.title.image.url;
                var genres = movieJson.genres;
                var plotOutline = movieJson.plotOutline.text;
                // if we get a result that doesn't have this structure, log error and don't append it to list
            }catch(error) {
                console.log('Movie details were: ',movieJson);
                console.log('but something went wrong for a detail: ',error);
            }
            // filter out low rating results
            if(ratingCount > ratingCountLimit){
                return new movieObject(id, title, released, ratingCount, rating, imageUrl, genres, plotOutline);
            } else {
                return 'Movie Too Small';
            }
        })
    )
    // remove elements that are too small (unpopular < ratingCountLimit)
    let popularMovieObjectLists = movieObjectsLists.filter(movie => movie !== 'Movie Too Small');
    return popularMovieObjectLists;
}

// function that query's multiple query strings to get actor details
async function fetchActorObjects(queryStringList){
    // https://dev.to/jamesliudotcc/how-to-use-async-await-with-map-and-promise-all-1gb5
    actorObjectList = await Promise.all(
        queryStringList.map(async queryString => {
            let filmResponse = await fetch(queryString, apiDetails)
            let ActorData =  await filmResponse.json();
            console.log("what to test for: ", ActorData.message);
            if(ActorData.message == "Too many requests"){
                document.getElementById("apiFailsafe").innerHTML = "You have searched too many times, please try again next month!";
                console.log("ERROR 429");
            }
            return new actorObject(
                // parameters are id, name and imgUrl
                ActorData.d[0].id, 
                ActorData.d[0].l, 
                ActorData.d[0].i.imageUrl
            )           
        })
    )
    return actorObjectList;
}

// function that query's multiple filmographies from actor objects
async function fetchActorFilmographyList(actorObjs){

    // ends with a list of json data from an asynchronous fetch of numerous urls
    movieNumberLists = await Promise.all(
        // for each actor obj in the list, asynchronously fetch api response, and map the json data
        actorObjs.map(async actorObj => {
            let filmographyApiUrlRoot = "https://imdb8.p.rapidapi.com/actors/get-all-filmography?nconst=";
            let actorMovieList = [];
            let response = await fetch(filmographyApiUrlRoot + actorObj.id, apiDetails);
            let jsonObject = await response.json();

            for(let i=0; i < jsonObject.filmography.length; i++){

                let movieObj = jsonObject.filmography[i];
                
                let titleType = movieObj.titleType;
                let category = movieObj.category;
                let movieId = movieObj.id.substring(7, 16);
                let acceptedStatus = ["completed", "released"]
                /* filters: 
                titleType = movie
                category = actor or actress
                image.url exists!
                status is in []
                */
                if(titleType === "movie" && (category === "actor" || category === "actress")){
                    // if it has an image
                    if(movieObj.image){
                        // if the status is either completed or released
                        if(acceptedStatus.includes(movieObj.status)){
                            actorMovieList.push(movieId);
                        }
                    }
                }
            }
            return actorMovieList;
        })
    )
    return movieNumberLists;
}

// function that query's actor known for list and pushes it to a list i.e [[known_for_list], ] to match downstream handling
async function fetchActorKnownForList(actorObj){

    // ends with a list of json data from a single fetch to 'known_for' endpoint;
    let movieNumberLists = []; 
    let actorMovieList = [];
    let filmographyApiUrlRoot = "https://imdb8.p.rapidapi.com/actors/get-known-for?nconst=";
    let response = await fetch(filmographyApiUrlRoot + actorObj.id, apiDetails);
    let jsonObject = await response.json();
    

    for(let i=0; i < jsonObject.length; i++){

        let movieObj = jsonObject[i];

        let titleType = movieObj.title.titleType;
        let category = movieObj.categories[0];
        let movieId = movieObj.title.id.substring(7, 16);
        let imageUrl = movieObj.title.image.url;
        /* filters: 
        titleType = movie
        category = actor or actress
        image.url exists!
        */
        if(titleType === "movie" && (category === "actor" || category === "actress")){
            // if it has an image
            if(imageUrl){
                actorMovieList.push(movieId);
            }
        }
    }
    
    // fudge the return structure to be the same as for multiple actors film lists in a list
    movieNumberLists.push(actorMovieList);
    
    return movieNumberLists;
}

// runs the search for the search strings from page input
async function runSearchWithInputValues(searchStrings){

    // disable search button
    document.getElementById("search_button").disabled = true;

    // -----------------------------------------LOADING ACTOR ID'S-------------------------------------
    // this function calls both fetches simultaneously to save time since the query's are independent
    let actorObjs = await fetchActorObjects(searchStrings);
    
    // -----------------------------------------QUERYING FILMOGRAPHYS-------------------------------------
    /* this is where we choose to query for one actors known for or multiple actors filmographies - both return a list of lists of movie number strings but the first one returns a list of length 1 with a list inside */
    let movieNumberLists = [];
    if(actorObjs.length == 1){
        console.log('getting actor known for since single actor query');
        movieNumberLists = await fetchActorKnownForList(actorObjs[0]);
    } else {
        console.log('getting actor filmographies since two actor query');
        movieNumberLists = await fetchActorFilmographyList(actorObjs);
    }

    // -----------------------ADDING MOVIE NUMBER LISTS TO ACTOR OBJECTS-------------------------------------

    // append the movie number lists to the actor objects - to make lookups easier in the future
    // since movie lists and actor objects must be the same length by design we can assume their lengths match
    for(let i = 0; i < actorObjs.length; i++){
        actorObjs[i].movieNumberList = movieNumberLists[i];
    }

    // this is where we use chris's matching function to get the shared movie list
    // make the list of objects that match and save it to the search object
    let matchedMovieNumbers = getCommonMovieObjects(movieNumberLists);
    

    // -----------------------------------------GET MOVIE OVERVIEW DETAILS----------------------------------

    // run fetch on movie numbers to get movie general details
    let matchedMovieDetailObjects = await fetchMovieGeneralDetailsResponse(matchedMovieNumbers);
    

    // -----------------------------------------STORING AND RENDERING-------------------------------------

    // Loading bar Hidden
    loadingHidden();

    // create a new search object with both actor objects and the matched movie list
    // set the index to the current search object index
    var newSearchObj = new searchObject(actorObjs, matchedMovieDetailObjects);

    // sort the movie list in descending order of popularity
    newSearchObj.sortMovieListDescending();

    // save the new object - this also updates the currentChoiceIndex
    saveSearchObject(newSearchObj);

    // dev: render to front page to confirm all is well with gathered results
    renderCurrentSearchObject();

    // disable search button
    document.getElementById("search_button").disabled = false;

}