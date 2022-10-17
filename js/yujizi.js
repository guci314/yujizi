
setInterval("saveState()",5000);

function saveState()
{
    var audios=document.getElementsByTagName("audio")
    for ( var i=0;i<audios.length;i++ ) {
        var id=audios[i].getAttribute("id");
        document.cookie=id+"="+document.getElementById(id).currentTime;
    }    
};

function loadState(){
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) 
    {
        var c = ca[i].trim();
        var x=c.split("=");
        var name=x[0];
        var value=x[1];
        //$("#test").append(name+"="+value+"   ");
        if (name.indexOf("audio")==0){
            audio=document.getElementById(name);
            audio.currentTime=value;
        }
    }
}

$(
    function(){
        loadState();    
    }
);