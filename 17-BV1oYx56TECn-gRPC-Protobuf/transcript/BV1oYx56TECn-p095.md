[00:00] Now let's create the final binary for our gRPC API. And we know that before we create the final binary, we need to make sure that our environment variables are properly loaded. And for training purposes, we are going to be using the same dot end file for environment variables. So in that case, we need to embed this dot end file into the API binary and then load that dot end file.
[00:29] before we start our server. So again this time we'll have to embed the .n file along with our exe file along with our source code. So again we need to embed the .n file along with our source code and for that we use the go embed directive.
[00:56] And that's it. So now the end file variable contains the .env file. And now we need to load the environment variables from this .env file. So first thing that we need to do is read the contents of .env file.
[01:20] then create a temporary file. So the first step will be to create a blank temp file and then read the contents from the .enf file and write that content to the temporary file and then close the temp file. And finally we are going to use the go.enf package to load the temporary file as environment variables.
[01:46] So let's create the function that we made in our REST API as well. And that function is load n from embedded file. And now let's call the n file dot read file and read contents from this file.
[02:14] And this is going to return as content as well as an error. Let's handle both.
[02:37] Now let's create a temporary file using the OS package and the method will be create temp. The directory is going to be blank here because we are not looking for any specific directory.
[03:04] and the name of the file will be .env and now this will return temporary file and error so let's handle both
[03:26] and we also then need to differ os.remove and then remove this temporary file so let's do that as well
[03:51] That's it. Now let's write content into this tempfile. And for that we call tempfile.write Pass it the content and that's it.
[04:20] It's going to return the number of bytes and error. So let's only handle the error. We don't need the number of bytes that have been written.
[04:44] And now we need to close the temp file to ensure that it is flushed to the disk.
[05:03] and handle the error as well and finally our file is ready
[05:30] and we can load the environment variables using this file. So let's call go.env and then the load method and now we need to pass the file name and that is going to be tempfile.name
[05:49] Let's handle the error and that's it. Let's save this and call this function in our main function.
[06:15] So this is the first thing that we need to do now. So this is now going to go away. I'm going to just comment this out for now. And now let's call load n from embedded file function to load the environment variables. Save this and the warnings are gone. And now we are ready to generate our API binary files.
[06:43] And I've already gone over how you can generate API binaries for other platforms for other operating systems and for other CPU architecture as well. Even if you are using AMD64 processor, you can still generate files for an ARM processor, an ARM32 or ARM64 processor. Even if you are on Windows or Linux, you can generate API binary for macOS.
[07:11] Or if you're on macOS, you can generate files for Linux or Windows or free BST, open BST, any operating system. So whatever system you're using, you can generate the API binary for other platforms for other CPU architectures as well. Using the goOS option with the goBuild command and also the goArc option, the goArchitecture option with the goBuild command. And we have already gone over that.
[07:39] when we were creating our binary for REST API. So this time I'm just going to create the binary for the system that I'm working on natively. So I'm going to run go build output file is going to be inside the binaries folder and
[08:01] It's actually going to be inside C&D, GRPC API and then binaries. And now I need the file name. So this is going to be GRPC API and AMD64 or alternately you can also use x8664.
[08:28] AMD64 or x8664 mean the same. So I'm going to use AMD64 here. And now my server.go file is inside CMD, gRPC API and then server.go. Alright, so this is it. Let's hit enter. And we have our binary file. Great.
[08:56] now we also have garble so so we also have garble here let's also create an obfuscated go binary file for our API and actually I made a mistake wait let me clear this we have implemented rate limiter and
[09:23] and while we will be benchmarking this is going to create a problem because because we have no idea how many requests we are going to be receiving in one minute or maybe actually 20 30 seconds so I'm not going to use rate limiter interceptor other interceptors are going to be okay but rate limiting is not going to be okay while benchmarking
[09:44] so let's comment this out save this
[10:14] And that's it. So let me rerun the go build command. And let me delete this. There we go. And now let's also build an obfuscated version of our API binary. And the command is going to be the same, apart from the difference that the prefix will not be go, it'll be garble.
[10:42] And we also need to change the name of the file, the name of the output file. So this is now obfuscated. All right, now these are both TLS versions. So I should rename these to...
[11:09] TLS. Okay, great. And let's now also create non TLS versions. So now let's comment these. And hence this part as well. And.
[11:37] WordWrap. And now this is also gone. Alright, that's it. Now let's build non-TLS versions of API.
[12:03] Actually, let me first change the name of the output file. And now instead of Garble, it'll be Go.
[12:25] Great. So we have our binaries ready and let's run them now. So the non TLS version is running. This is the non obfuscated binary. Let's close this and now
[12:52] We test the TLS version. So both non obfuscated versions are running perfectly. Now let's call the obfuscated version. And always remember that you need to use dot and then forward slash. Otherwise this is not going to work.
[13:16] Because when you try to do this it will not recognize this as a command because it is not a command. Alright it is an executable file and executable files need to run with a dot and forward slash in Linux. So now let's call obfuscated non-TLS first and it's running as well. And now the TLS.
[13:45] All right, so now that our binaries are ready, let's get to benchmarking.
[13:51] Thank you.
