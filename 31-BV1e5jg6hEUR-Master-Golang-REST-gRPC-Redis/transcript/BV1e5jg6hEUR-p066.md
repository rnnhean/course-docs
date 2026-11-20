[00:00] Hello and welcome. On this lecture we will start actually restructuring our application and we will start make our application ready for combining all the services in just one place. The main idea here is that instead of have our backend on several places what we want to do right now is to start combine all together which will force us
[00:29] to canceling the GRBC connection since that all will be on the same environment. Alright, let's just start by removing this build file. And let's just also start create a directory here inside the API. Let's just call the directory cmd.
[00:57] okay inside of it we need to create main.go natural take package main okay so we want to run all the services inside this file
[01:27] what we can do is to cut all this and just paste it here and now we can remove our main i didn't need it anymore and i need to clear this a little bit just remove this one okay we want to have a separate file which will be responsible
[01:55] for droughts or setup droughts or APIs so let's just create a new file here call it setup api.go all right and on this file I just started by giving the same package name
[02:25] and then we need to create a function that would be responsible for set up our APIs and I just call it set up API this will take up pointer of fiber up okay we can look anything here I just log print
[02:55] printlin something like setting up api routes okay call next we want to set up all the existing apis we just grab it all from here
[03:22] i just got this and paste that here okay and we need to get this api from the server which is the main package name all right i think we can also add api for health check and just create it up get api slash api
[03:50] slash health all right give it the function C fiber pointer of fiber CTX this returns an error capital CTX yeah
[04:19] we can just now come up here say return c.json fiber map status health healthy
[04:49] service can be api we can also add the service connected how many other things but I'll just leave it with that now we just add println we can just say
[05:19] py routes configured successfully all right we're done with that now i just go back on main okay next i just go to the main and then i think that we can get rid
[05:48] of all this we don't need this anymore but let's just do this update okay and then we just came up here say set up api routes and then let's save okay next we need to set out to call this
[06:17] set up api by storing the app okay and then we can let's see now what we can do is to call go run cmd slash main.go and cmd slash set up
[06:45] api.go and head enter all right setting up api routes configured we just hit allow access go back if reach the page it look like everything is okay or if we go to just slash return or come to social okay look like that everything is okay
[07:14] all right let's just check this one more time the database connected successfully every single lock school okay I think that's good on this lecture from the next lecture we will start move the real-time notification inside our API let's just start our conduct on the next lecture
