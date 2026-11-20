[00:00] All right, so now that we are finished with protocol buffers, let's create our server. So let me create a new file here, and this is server.go. Perfect. PMFM. And in order to create a server, we call GRPC, but we don't have GRPC as of yet. If we type this, we don't have anything.
[00:29] So the first thing that we need to do is initialize our module. So go mod init and this is gRPC API. Alright. And now let's import the gRPC package. So that's going to be google.golang.org forward slash gRPC.
[00:57] great so now we can call grpc.newServer and this is going to return us a new server so I'm going to save that server into s
[01:17] And now for creating the struct, I'm going to create a new file in API Handlers. And the name of this file is going to be server underscore struct dot go. I'm going to keep the server dot go file clean and it will only be about the main function of the server.
[01:44] Anything else will have to be delegated to different files in the folder structure. So this is package handlers and now here we are going to import the generated files from protocol buffers. So first we need to mention our module name and then proto forward slash gen and let me name this
[02:12] PB and now we create the server struct and pass it PB dot unimplemented teacher service and student so PB dot unimplemented student and again unimplemented teacher
[02:42] all right let's save this and this is it and now let's go back to our server and now we are going to import the same thing over here so import gRPC API Proto and Gen again let me shorten the name to PB and now I'm going to call PB dot register
[03:11] for all of these services. Alright and they're all going to need the same arguments s comma and I need to import handlers as well so I'm going to mention handlers like this but then I'm going to add m% and then dot server.
[03:38] and let's copy all these arguments and paste them into the next functions. Alright and during development we are also going to implement reflection and pass it the server as the argument. Now let's also declare our port but I'm going to declare that in the environment variable file and
[04:07] let me declare server port here support is going to be os.getenv and then server underscore port
[04:33] but in order to load the environment variables from the .n file as operating system environment variables we need the go.n package from joho. so let's import that as well go get and now we need to load the environment variables from the .n file
[05:00] so we call go.env.load and let's handle the error
[05:21] All right, perfect. Now we print a confirmation statement that the server is running on port actually gRPC server.
[05:49] and now let's start listening on this port so net.listen and it needs the network protocol so that is TCP and then it needs the address actually the port so that is the port let me scroll this and net.listen returns us a listener and error
[06:16] and finally we start serving requests from the gRPC server so gRPC server is s so we call s.serve now in order to serve requests our gRPC server needs a channel a window
[06:45] any medium to communicate with the outside world and that is going to be the listener which has the access to the port through which we communicate with the outside world using a computer so we pass it the listener and we know this returns an error so we handle the error
[07:08] and the messages are going to be different so this is going to be error listening on
[07:31] and this is going to save field to serve so let's save this all right so let's seed into the cmd folder and then gRPC API and then we run the server perfect so we have a successfully running server great
[08:00] you
